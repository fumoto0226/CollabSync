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
 * durationDays 表示用户激活后的有效期（默认 90 天），激活码本身在使用前永不过期
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
 * 已使用且用户激活尚未过期的码不允许删除（保护活跃用户）
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

    // 已使用且对应用户激活仍有效 → 不允许删除
    if (data.usedCount > 0) {
        if (data.userActivationInfinite) {
            throw new HttpsError(
                "failed-precondition",
                "该激活码用户为永久激活，无法删除。请先调整该用户的到期时间。"
            );
        }
        const userExpiresMs = data.userActivationExpiresAt && data.userActivationExpiresAt.toMillis
            ? data.userActivationExpiresAt.toMillis()
            : null;
        if (userExpiresMs && Date.now() < userExpiresMs) {
            throw new HttpsError(
                "failed-precondition",
                "该激活码已被使用且尚未过期，无法删除。请等待过期后再删除。"
            );
        }
        // 旧数据回退：按 usedAt 或 createdAt + durationDays 计算
        if (!userExpiresMs) {
            const baseMs = data.usedAt && data.usedAt.toMillis
                ? data.usedAt.toMillis()
                : (data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : 0);
            const expiryMs = baseMs + (data.durationDays || 90) * 86400000;
            if (baseMs && Date.now() < expiryMs) {
                throw new HttpsError(
                    "failed-precondition",
                    "该激活码已被使用且尚未过期，无法删除。请等待过期后再删除。"
                );
            }
        }
    }

    await docRef.delete();

    return { success: true };
});

/**
 * activateUser
 * 用户输入激活码来激活自己的账号
 * 倒计时从用户激活的那一刻开始计算
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
        if (userData.activationInfinite) {
            throw new HttpsError("already-exists", "您的账号已经激活，无需重复激活");
        }
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

    // 激活码在使用前永不过期；倒计时从此刻开始
    const now = admin.firestore.Timestamp.now();
    const durationMs = (codeData.durationDays || 90) * 86400000;
    const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + durationMs);

    const batch = db.batch();

    // 更新用户文档
    batch.update(db.collection("users").doc(uid), {
        activatedAt: now,
        activationExpiresAt: expiresAt,
        activationInfinite: false,
        activationCode: code.toUpperCase(),
    });

    // 更新激活码文档（写入用户到期时间以供管理面板展示）
    batch.update(codeRef, {
        usedCount: 1,
        usedByUid: uid,
        usedByEmail: email,
        usedAt: now,
        userActivationExpiresAt: expiresAt,
        userActivationInfinite: false,
    });

    await batch.commit();

    return {
        success: true,
        activatedAt: now.toMillis(),
        activationExpiresAt: expiresAt.toMillis(),
    };
});

/**
 * setUserActivationExpiry
 * 管理员调整某个用户的激活到期时间，可设置为指定时间或永久
 * 入参：{ uid: string, expiresAt?: number(millis), infinite?: boolean }
 */
exports.setUserActivationExpiry = onCall(async (request) => {
    assertAdmin(request);

    const { uid, expiresAt, infinite } = request.data || {};
    if (!uid || typeof uid !== "string") {
        throw new HttpsError("invalid-argument", "缺少用户 UID");
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new HttpsError("not-found", "用户不存在");
    }

    const userUpdates = {};
    const codeUpdates = {};

    if (infinite) {
        userUpdates.activationInfinite = true;
        userUpdates.activationExpiresAt = admin.firestore.FieldValue.delete();
        codeUpdates.userActivationInfinite = true;
        codeUpdates.userActivationExpiresAt = admin.firestore.FieldValue.delete();
    } else {
        const ms = Number(expiresAt);
        if (!ms || isNaN(ms)) {
            throw new HttpsError("invalid-argument", "无效的到期时间");
        }
        const ts = admin.firestore.Timestamp.fromMillis(ms);
        userUpdates.activationInfinite = false;
        userUpdates.activationExpiresAt = ts;
        codeUpdates.userActivationInfinite = false;
        codeUpdates.userActivationExpiresAt = ts;
    }

    await userRef.update(userUpdates);

    // 同步到对应的激活码文档（如有）
    const userData = userSnap.data();
    const code = userData.activationCode;
    if (code) {
        const codeRef = db.collection("activationCodes").doc(code);
        const codeSnap = await codeRef.get();
        if (codeSnap.exists) {
            await codeRef.update(codeUpdates);
        }
    }

    return { success: true };
});

/**
 * cleanExpiredCodes
 * 管理员调用，删除已使用且对应用户激活过期超过 24 小时的激活码
 * 未使用的激活码永不自动删除
 */
exports.cleanExpiredCodes = onCall(async (request) => {
    assertAdmin(request);

    const snapshot = await db.collection("activationCodes").get();
    const now = Date.now();
    const batch = db.batch();
    let deletedCount = 0;

    snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (!data.usedCount || data.usedCount <= 0) return; // 未使用永不清理
        if (data.userActivationInfinite) return; // 永久激活不清理

        let expiryMs = null;
        if (data.userActivationExpiresAt && data.userActivationExpiresAt.toMillis) {
            expiryMs = data.userActivationExpiresAt.toMillis();
        } else if (data.usedAt && data.usedAt.toMillis) {
            expiryMs = data.usedAt.toMillis() + (data.durationDays || 90) * 86400000;
        } else if (data.createdAt && data.createdAt.toMillis) {
            expiryMs = data.createdAt.toMillis() + (data.durationDays || 90) * 86400000;
        }

        if (expiryMs && now > expiryMs + 24 * 3600000) {
            batch.delete(doc.ref);
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        await batch.commit();
    }

    return { deletedCount };
});
