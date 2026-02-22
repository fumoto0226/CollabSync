const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ========== 管理员白名单 ==========
const ADMIN_UIDS = new Set([
    "0gKyPFlHBGg6jdljKDZ02gP8zGl1",
]);

// ========== 工具函数 ==========

/**
 * 生成随机激活码（12 位大写字母 + 数字，排除 O/0/I/1）
 */
function generateCode(length = 12) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * 检查调用者是否为管理员
 */
function assertAdmin(request) {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "用户未登录");
    }
    if (!ADMIN_UIDS.has(request.auth.uid)) {
        throw new HttpsError("permission-denied", "没有管理员权限");
    }
}

// ========== Cloud Functions ==========

/**
 * createActivationCodes
 * 生成一个随机激活码并写入 Firestore 的 activationCodes 集合
 */
exports.createActivationCodes = onCall(async (request) => {
    assertAdmin(request);

    const code = generateCode(12);

    const batch = db.batch();
    const docRef = db.collection("activationCodes").doc(code);

    batch.set(docRef, {
        code: code,
        maxUses: 1,
        usedCount: 0,
        durationDays: 90,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return { code };
});

/**
 * deleteActivationCode
 * 删除指定的激活码
 * 已使用且未过期的码不允许删除（保护活跃用户）
 */
exports.deleteActivationCode = onCall(async (request) => {
    assertAdmin(request);

    const code = request.data?.code;
    if (!code || typeof code !== "string") {
        throw new HttpsError("invalid-argument", "缺少激活码参数");
    }

    const docRef = db.collection("activationCodes").doc(code);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        throw new HttpsError("not-found", "激活码不存在");
    }

    const data = docSnap.data();

    // 已使用且未过期 → 不允许删除
    if (data.usedCount > 0 && data.createdAt) {
        const createdMs = data.createdAt.toMillis();
        const expiryMs = createdMs + (data.durationDays || 90) * 86400000;
        if (Date.now() < expiryMs) {
            throw new HttpsError(
                "failed-precondition",
                "该激活码已被使用且尚未过期，无法删除。请等待过期后再删除。"
            );
        }
    }

    await docRef.delete();

    return { success: true };
});

/**
 * activateUser
 * 用户输入激活码来激活自己的账号
 * 在用户文档写入 activatedAt + activationExpiresAt
 * 在激活码文档写入 usedCount, usedByUid, usedByEmail, usedAt
 */
exports.activateUser = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "用户未登录");
    }

    const code = request.data?.code;
    if (!code || typeof code !== "string") {
        throw new HttpsError("invalid-argument", "请输入激活码");
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email || "";

    // 检查用户是否已经激活
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.activationExpiresAt && userData.activationExpiresAt.toMillis() > Date.now()) {
            throw new HttpsError("already-exists", "您的账号已经激活，无需重复激活");
        }
    }

    // 检查激活码
    const codeRef = db.collection("activationCodes").doc(code.toUpperCase());
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
        throw new HttpsError("not-found", "无效的激活码");
    }

    const codeData = codeSnap.data();

    // 检查是否已被使用
    if (codeData.usedCount >= codeData.maxUses) {
        throw new HttpsError("resource-exhausted", "该激活码已被使用");
    }

    // 检查是否过期
    if (codeData.createdAt) {
        const createdMs = codeData.createdAt.toMillis();
        const expiryMs = createdMs + (codeData.durationDays || 90) * 86400000;
        if (Date.now() > expiryMs) {
            throw new HttpsError("deadline-exceeded", "该激活码已过期");
        }
    }

    const now = admin.firestore.Timestamp.now();
    const durationMs = (codeData.durationDays || 90) * 86400000;
    const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + durationMs);

    const batch = db.batch();

    // 更新用户文档
    batch.update(db.collection("users").doc(uid), {
        activatedAt: now,
        activationExpiresAt: expiresAt,
        activationCode: code.toUpperCase(),
    });

    // 更新激活码文档
    batch.update(codeRef, {
        usedCount: 1,
        usedByUid: uid,
        usedByEmail: email,
        usedAt: now,
    });

    await batch.commit();

    return {
        success: true,
        activatedAt: now.toMillis(),
        activationExpiresAt: expiresAt.toMillis(),
    };
});

/**
 * cleanExpiredCodes
 * 管理员调用，删除所有已过期超过 24 小时的激活码
 */
exports.cleanExpiredCodes = onCall(async (request) => {
    assertAdmin(request);

    const snapshot = await db.collection("activationCodes").get();
    const now = Date.now();
    const batch = db.batch();
    let deletedCount = 0;

    snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.createdAt) {
            const createdMs = data.createdAt.toMillis();
            const expiryMs = createdMs + (data.durationDays || 90) * 86400000;
            const gracePeriodMs = expiryMs + 24 * 3600000; // 过期后 24 小时

            if (now > gracePeriodMs) {
                batch.delete(doc.ref);
                deletedCount++;
            }
        }
    });

    if (deletedCount > 0) {
        await batch.commit();
    }

    return { deletedCount };
});
