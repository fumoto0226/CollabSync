const AIService = {
    generateTodoSuggestions: async (taskName, description) => {
        console.log("Mocking AI Call for:", taskName);
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    "跟进需求文档确认细节",
                    "创建初步视觉草稿",
                    "与开发团队评审可行性",
                    "准备演示用的 Mockup"
                ]);
            }, 1000);
        });
    },
    summarizeProjectStatus: async (projectName, activeCount, lockedNames) => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`"${projectName}" 状态火热！${activeCount} 个任务正在推进，大家冲鸭！🚀`);
            }, 800);
        });
    }
};

const EMOJI_POOL = `🐶🐰🐻‍❄️🐮🐵🐒🐤🐱🦊🐨🐷🙈🐣🐭🐻🐯🐽🙉🐧🐥🐹🐼🦁🙊🐦🪿🦆🦄🐜🦟🐦‍⬛🐺🦋🦅🐗🐝🐌🪲🦉🐴🐞🦖🪼🐳🐊🦍🦐🦧🐙🦞🐟🦀🐬🦭🐩🐈‍⬛🦥🦔🕊️🦜🐇🦫🐀🐉🦃🦢🦝🦦🐿️🐲🐦‍🔥🍏🍋🍇🍒🥥🥑🥒🍎🍋‍🟩🍓🍑🥝🫛🌶️🍐🍌🫐🥭🍅🥦🫑🍊🍉🍈🍍🍆🌽🥕🥔🥐🥨🥩🌭🫒🍣🍤🥪🍱🍙🥫🥟🍚🥗🍘🍥🍡🍿🥜🥠🍧🧁🍭🍩🥛🍯🍪🌰🍫🎂🍦🍢🍬🍰🍨🥮🍼🧊⚽️🥎🥏🏀🎾🎱🏈🏐🪀⚾️🏉🏓🚗🚨🚘🚃✈️🚀🛟⛺️⛰️🏠💿📟☎️💎🧨🔮💈💊🩸🧽🎁🛎️🪣🎈💛🧡❤️🩷💚🩵💙💜🤎🤍🩶🖤💔❤️‍🔥❤️‍🩹💝💘💖💗⚠️🔰💢😀😆🤣😇😌😗😛😃🥹🥲🙂😍😙😝😄😅☺️🙃🥰😚😜😁😂😊😉😘😋🤪🤨🥸😩😤🧐🤩🥺😠🤓🥳🙂‍↔️😖😢😡😎😫😭🤬🤯😶‍🌫️😱😳🥵🥶😰🫥🫨🤥🫠🫡🙄😵‍💫🤤😵😴🥱😪😮‍💨🤢😈🤡🤑🤧🤐🤕💩👽👻💀☠️🎃👾🤖💩🤡🤲👊😻🙀👌🫀👀👷‍♂️🧑‍💻👩‍💻🧑‍🚀🥷🙅‍♂️🙅‍♀️💆‍♂️🙎‍♂️🙎‍♀️🤷‍♀️🤦‍♂️🤦🤦‍♀️🩳🧤🍄🌏⭐️🍔🌭🍟🍖🥩🥪🧀`;
const splitEmojiGraphemes = (input) => {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        return Array.from(segmenter.segment(input), s => s.segment);
    }
    return Array.from(input);
};
const EMOJIS = splitEmojiGraphemes(EMOJI_POOL).filter(e => /\p{Extended_Pictographic}/u.test(e));
const EMOJI_SET = new Set(EMOJIS);

const pickRandomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
const normalizeEmoji = (emoji) => EMOJI_SET.has(emoji) ? emoji : '🙂';

const getStoredEmoji = (userId) => localStorage.getItem(`emoji_${userId}`);
const setStoredEmoji = (userId, emoji) => localStorage.setItem(`emoji_${userId}`, emoji);

const AvatarEmoji = (emoji, sizeCls="w-8 h-8", textCls="text-xl") => `
    <div class="${sizeCls} flex items-center justify-center select-none bg-gray-50">
        <span class="${textCls} emoji-glyph">${normalizeEmoji(emoji)}</span>
    </div>
`;

const MOCK_USERS = [
    { id: 'u1', name: '我', status: 'online' },
    { id: 'u2', name: 'Alexander W.', status: 'busy' },
    { id: 'u3', name: 'Lisa', status: 'offline' },
    { id: 'u4', name: 'Tony', status: 'offline' },
].map(u => {
    let emoji = getStoredEmoji(u.id);
    if (!emoji || !EMOJI_SET.has(emoji)) {
        emoji = pickRandomEmoji();
        setStoredEmoji(u.id, emoji);
    }
    u.emoji = emoji;
    return u;
});
