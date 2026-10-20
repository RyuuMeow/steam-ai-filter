"use strict";
var SAFDisclosure;
(function (SAFDisclosure) {
    // Local keyword packs, applied only to the developer's AI disclosure.
    // Avoid ambiguous standalone words such as model, script, asset and character.
    SAFDisclosure.packs = {
        art: {
            label: "美術",
            pattern: /\b(?:arts?|artworks?|visuals?|images?|pictures?|illustrations?|portraits?|textures?|sprites?|icons?|animations?|videos?|cinematics?|cutscenes?|[23]d (?:models?|assets?)|concept art|backgrounds?(?!\s+(?:music|audio|sounds?|tasks?|processes?))|midjourney|dall[ -]?e|stable diffusion)\b|美術|美术|繪圖|绘图|圖片|图片|圖像|图像|圖示|图标|插畫|插画|貼圖|贴图|立繪|立绘|動畫|动画|影片|視頻|视频|(?:3d|三維|三维)模型|背景(?:圖|图|美術|美术)/u
        },
        music: {
            label: "音樂／音效",
            pattern: /\b(?:music|songs?|soundtracks?|sound effects?|sfx|suno|udio)\b|音樂|音乐|音效|歌曲|配樂|配乐/u
        },
        voice: {
            label: "配音",
            pattern: /\b(?:voices?|voice[ -]?overs?|voice acting|narration|speech synthesis|text[ -]to[ -]speech|tts|elevenlabs)\b|配音|語音|语音|聲音合成|声音合成/u
        },
        text: {
            label: "劇情／文字",
            pattern: /\b(?:stories|story|storylines?|narratives?|plot|dialogue|dialog|text|writing|copywriting|written content)\b|劇情|剧情|故事|對話|对话|台詞|台词|文案|文字|文本|寫作|写作/u
        },
        translation: {
            label: "翻譯",
            pattern: /\b(?:translat(?:e[ds]?|ing|ions?|or)|locali[sz](?:ation|e[ds]?|ing)|deepl)\b|翻譯|翻译|在地化|本地化/u
        },
        code: {
            label: "程式碼",
            pattern: /\b(?:code|coding|programming|debugging|debug|github copilot)\b|程式(?:碼|設計|開發)?|程序(?:代码|设计|开发)?|代碼|代码|除錯|调试/u
        }
    };
    SAFDisclosure.categories = Object.keys(SAFDisclosure.packs);
})(SAFDisclosure || (SAFDisclosure = {}));
