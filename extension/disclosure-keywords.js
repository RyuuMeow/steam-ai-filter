"use strict";
var SAFDisclosure;
(function (SAFDisclosure) {
    // Bundled, local rules. Match the developer's disclosure only, never titles/tags.
    // Keep alternatives explicit: adding a word can change which games are exempted.
    SAFDisclosure.keywords = {
        code: /\b(?:code|coding|programming|debugging|debug)\b|程式(?:碼|設計|開發)?|程序(?:代码|设计|开发)?|代碼|代码|除錯|调试/u,
        exclusive: /\b(?:only|solely|exclusively|limited to|restricted to)\b|僅|仅|只(?:有|用|使|限|在)|限於|限于/u,
        nonCode: /\b(?:arts?|artwork|visuals?|images?|pictures?|illustrations?|portraits?|textures?|models?|sprites?|icons?|backgrounds?|animations?|videos?|cinematics?|cutscenes?|assets?|audio|sounds?|music|songs?|voices?|voiceovers?|narration|narrative|stories|story|storylines?|plot|dialogue|dialog|translations?|locali[sz]ation|text|writing|copywriting|marketing|capsules?|characters?|npcs?|levels?|worlds?|maps?|environments?|terrain|layouts?|gameplay|mechanics|concepts?|game design|content|midjourney|suno|udio|dall[ -]?e|stable diffusion)\b|美術|美术|繪圖|绘图|圖片|图片|圖像|图像|圖示|图标|插畫|插画|背景|貼圖|贴图|模型|角色|素材|資產|资产|動畫|动画|影片|視頻|视频|音樂|音乐|音效|聲音|声音|語音|语音|配音|劇情|剧情|故事|對話|对话|文案|文字|翻譯|翻译|在地化|本地化|行銷|营销|關卡|关卡|地圖|地图|玩法|內容|内容/u,
        uncertain: /\b(?:mainly|mostly|primarily|generally|including|such as|etc|et cetera|and more|other uses|other purposes|other things|everything else|the rest|remaining content|not only|not just|except|apart from|in addition|also)\b|主要|大多|大部分|包括|包含|等等|其他用途|其餘|其余|不只|不僅|不仅|除了|另外|此外|還用|还用/u,
        live: /\b(?:real[ -]?time|runtime|live[ -]?generated|during gameplay|while playing)\b|即時生成|即时生成|遊玩時生成|游玩时生成/u,
        codeDenied: /\b(?:no|never|not|without)\b[^.;。；]{0,40}\b(?:ai|generative|generated|assisted)\b[^.;。；]{0,25}\b(?:code|coding|programming)\b|\b(?:code|coding|programming)\b[^.;。；]{0,25}\b(?:not|never)\b|(?:未|沒有|没有|不曾)[^。；]{0,15}(?:程式|代码|代碼|程序)/u,
        humanCode: /\b(?:code|coding|programming)\b[^.;。；]{0,35}\b(?:human|hand[ -]written|manually written)\b|\b(?:human[ -]written|hand[ -]written)\b[^.;。；]{0,15}\bcode\b|(?:程式|代码|代碼|程序)[^。；]{0,20}(?:手寫|手写|人工撰寫|人工编写)/u,
        // Capture only the asset list; the classifier rejects any extra unparsed words.
        noContent: /^(?:no|without|we (?:do|did) not use(?: any)?) (?:ai(?:[- ]generated|[- ]assisted)?|generative ai) (.+?)(?: (?:is|are|was|were) (?:used|included)(?: in (?:the|this|our) game)?)?$/u,
        humanContent: /^(?:all |the |our )?(.+?) (?:is|are|was|were) (?:hand[ -]?(?:made|drawn|crafted|written)|created by humans|made by humans|human[ -]created|human[ -]made|manually created)$/u,
        noContentChinese: /^(?:沒有|没有|未使用|不使用|無|无)\s*(?:任何)?(?:由)?(?:ai|生成式ai|人工智慧|人工智能)\s*(?:生成的|產生的|产生的)?(.+)$/u,
        humanContentChinese: /^(?:所有|全部)?(.+?)(?:皆為|均為|均为|都是|為|为)(?:手工製作|手工制作|手繪|手绘|人工製作|人工制作)$/u,
        contentList: /\b(?:arts?|artwork|visuals?|images?|pictures?|illustrations?|portraits?|textures?|models?|sprites?|icons?|backgrounds?|animations?|videos?|assets?|audio|sounds?|music|songs?|voices?|voiceovers?|narration|narrative|story|dialogue|dialog|translations?|text|content|and|or|any|in[ -]game|game)\b|美術|美术|圖片|图片|圖像|图像|插畫|插画|背景|貼圖|贴图|模型|角色|素材|資產|资产|動畫|动画|影片|音樂|音乐|音效|聲音|声音|語音|语音|配音|劇情|剧情|故事|對話|对话|文案|文字|翻譯|翻译|內容|内容|及|或|與|与|和|[,\s，、/&-]/gu
    };
})(SAFDisclosure || (SAFDisclosure = {}));
