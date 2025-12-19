"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChineseZodiacController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class ChineseZodiacController {
    constructor() {
        this.FREE_MESSAGES_LIMIT = 3;
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        this.chatWithMaster = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { zodiacData, userMessage, birthYear, birthDate, fullName, conversationHistory, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateHoroscopeRequest(zodiacData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                console.log(`📊 Horoscope - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`);
                const contextPrompt = this.createHoroscopeContext(zodiacData, birthYear, birthDate, fullName, conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? `1. DEBES generar una respuesta COMPLETA de entre 300-550 palabras
2. Si tienes la fecha de nacimiento, COMPLETA el análisis del signo zodiacal
3. Incluye características, elemento, planeta regente y compatibilidades
4. Proporciona predicciones y consejos basados en el signo
5. Ofrece guía práctica basada en la sabiduría astrológica`
                    : `1. DEBES generar una respuesta PARCIAL de entre 100-180 palabras
2. INSINÚA que has identificado el signo y sus influencias
3. Menciona que tienes información valiosa pero NO la reveles completamente
4. Crea MISTERIO y CURIOSIDAD sobre lo que las estrellas dicen
5. Usa frases como "Tu signo revela algo fascinante...", "Las estrellas me muestran influencias muy especiales en tu vida...", "Veo características muy interesantes que..."
6. NUNCA completes el análisis del signo, déjalo en suspenso`;
                const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
${responseInstructions}
- NUNCA dejes una respuesta a medias o incompleta según el tipo de respuesta
- Si mencionas características del signo, ${shouldGiveFullResponse
                    ? "DEBES completar la descripción"
                    : "crea expectativa sin revelar todo"}
- SIEMPRE mantén el tono astrológico amigable y místico
- Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta de la astróloga (EN ESPAÑOL):`;
                console.log(`Generando consulta de horóscopo (${shouldGiveFullResponse ? "COMPLETA" : "PARCIAL"})...`);
                let text = "";
                let usedModel = "";
                let allModelErrors = [];
                for (const modelName of this.MODELS_FALLBACK) {
                    console.log(`\n🔄 Trying model: ${modelName}`);
                    try {
                        const model = this.genAI.getGenerativeModel({
                            model: modelName,
                            generationConfig: {
                                temperature: 0.85,
                                topK: 50,
                                topP: 0.92,
                                maxOutputTokens: shouldGiveFullResponse ? 700 : 300,
                                candidateCount: 1,
                                stopSequences: [],
                            },
                            safetySettings: [
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                                },
                                {
                                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                            ],
                        });
                        let attempts = 0;
                        const maxAttempts = 3;
                        let modelSucceeded = false;
                        while (attempts < maxAttempts && !modelSucceeded) {
                            attempts++;
                            console.log(`  Attempt ${attempts}/${maxAttempts} with ${modelName}...`);
                            try {
                                const result = yield model.generateContent(fullPrompt);
                                const response = result.response;
                                text = response.text();
                                const minLength = shouldGiveFullResponse ? 100 : 50;
                                if (text && text.trim().length >= minLength) {
                                    console.log(`  ✅ Success with ${modelName} on attempt ${attempts}`);
                                    usedModel = modelName;
                                    modelSucceeded = true;
                                    break;
                                }
                                console.warn(`  ⚠️ Response too short, retrying...`);
                                yield new Promise((resolve) => setTimeout(resolve, 500));
                            }
                            catch (attemptError) {
                                console.warn(`  ❌ Attempt ${attempts} failed:`, attemptError.message);
                                if (attempts >= maxAttempts) {
                                    allModelErrors.push(`${modelName}: ${attemptError.message}`);
                                }
                                yield new Promise((resolve) => setTimeout(resolve, 500));
                            }
                        }
                        if (modelSucceeded) {
                            break;
                        }
                    }
                    catch (modelError) {
                        console.error(`  ❌ Model ${modelName} failed completely:`, modelError.message);
                        allModelErrors.push(`${modelName}: ${modelError.message}`);
                        yield new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                if (!text || text.trim() === "") {
                    console.error("❌ All models failed. Errors:", allModelErrors);
                    throw new Error(`Todos los modelos de IA no están disponibles actualmente. Por favor, inténtalo de nuevo en un momento.`);
                }
                let finalResponse;
                if (shouldGiveFullResponse) {
                    finalResponse = this.ensureCompleteResponse(text);
                }
                else {
                    finalResponse = this.createHoroscopePartialResponse(text);
                }
                const chatResponse = {
                    success: true,
                    response: finalResponse.trim(),
                    timestamp: new Date().toISOString(),
                    freeMessagesRemaining: freeMessagesRemaining,
                    showPaywall: !shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT,
                    isCompleteResponse: shouldGiveFullResponse,
                };
                if (!shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT) {
                    chatResponse.paywallMessage =
                        "Has usado tus 3 mensajes gratuitos. ¡Desbloquea acceso ilimitado para descubrir todo lo que las estrellas tienen para ti!";
                }
                console.log(`✅ Consulta de horóscopo generada (${shouldGiveFullResponse ? "COMPLETA" : "PARCIAL"}) con ${usedModel} (${finalResponse.length} caracteres)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getChineseZodiacInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    master: {
                        name: "Astróloga Luna",
                        title: "Guía Celestial de los Signos",
                        specialty: "Astrología occidental y horóscopo personalizado",
                        description: "Sabia astróloga especializada en interpretar las influencias celestiales y la sabiduría de los doce signos zodiacales",
                        services: [
                            "Interpretación de signos zodiacales",
                            "Análisis de cartas astrales",
                            "Predicciones horoscópicas",
                            "Compatibilidades entre signos",
                            "Consejos basados en astrología",
                        ],
                    },
                    freeMessagesLimit: this.FREE_MESSAGES_LIMIT,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno");
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    hasFullAccess(messageCount, isPremiumUser) {
        return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
    }
    // ✅ GANCHO SOLO EN ESPAÑOL
    generateHoroscopeHookMessage() {
        return `

⭐ **¡Espera! Las estrellas me han revelado información extraordinaria sobre tu signo...**

He consultado las posiciones planetarias y tu signo zodiacal, pero para revelarte:
- ♈ Tu **análisis completo del signo** con todas sus características
- 🌙 Las **influencias planetarias** que te afectan este mes
- 💫 Tu **compatibilidad amorosa** con todos los signos
- 🔮 Las **predicciones personalizadas** para tu vida
- ⚡ Tus **fortalezas ocultas** y cómo potenciarlas
- 🌟 Los **días favorables** según tu configuración astral

**Desbloquea tu horóscopo completo ahora** y descubre todo lo que las estrellas tienen preparado para ti.

✨ *Miles de personas ya han transformado su vida con la guía de los astros...*`;
    }
    // ✅ PROCESAR RESPUESTA PARCIAL (TEASER)
    createHoroscopePartialResponse(fullText) {
        const sentences = fullText
            .split(/[.!?]+/)
            .filter((s) => s.trim().length > 0);
        const teaserSentences = sentences.slice(0, Math.min(3, sentences.length));
        let teaser = teaserSentences.join(". ").trim();
        if (!teaser.endsWith(".") &&
            !teaser.endsWith("!") &&
            !teaser.endsWith("?")) {
            teaser += "...";
        }
        const hook = this.generateHoroscopeHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = ![
            "!",
            "?",
            ".",
            "…",
            "✨",
            "🌟",
            "♈",
            "♉",
            "♊",
            "♋",
            "♌",
            "♍",
            "♎",
            "♏",
            "♐",
            "♑",
            "♒",
            "♓",
        ].includes(lastChar);
        if (endsIncomplete && !processedText.endsWith("...")) {
            const sentences = processedText.split(/([.!?])/);
            if (sentences.length > 2) {
                let completeText = "";
                for (let i = 0; i < sentences.length - 1; i += 2) {
                    if (sentences[i].trim()) {
                        completeText += sentences[i] + (sentences[i + 1] || ".");
                    }
                }
                if (completeText.trim().length > 100) {
                    return completeText.trim();
                }
            }
            processedText = processedText.trim() + "...";
        }
        return processedText;
    }
    // ✅ CONTEXTO SOLO EN ESPAÑOL
    createHoroscopeContext(zodiacData, birthYear, birthDate, fullName, history, isFullResponse = true) {
        const conversationContext = history && history.length > 0
            ? `\n\nCONVERSACIÓN PREVIA:\n${history
                .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        const horoscopeDataSection = this.generateHoroscopeDataSection(birthYear, birthDate, fullName);
        const responseTypeInstructions = isFullResponse
            ? `
📝 TIPO DE RESPUESTA: COMPLETA
- Proporciona análisis horoscópico COMPLETO y detallado
- Si tienes la fecha, COMPLETA el análisis del signo zodiacal
- Incluye características, elemento, planeta regente
- Respuesta de 300-550 palabras
- Ofrece predicciones y consejos basados en el signo`
            : `
📝 TIPO DE RESPUESTA: PARCIAL (TEASER)
- Proporciona un análisis INTRODUCTORIO e intrigante
- Menciona que has identificado el signo y sus influencias
- INSINÚA información valiosa sin revelarla completamente
- Respuesta de 100-180 palabras máximo
- NO reveles análisis completos del signo
- Crea MISTERIO y CURIOSIDAD
- Termina de forma que el usuario quiera saber más
- Usa frases como "Tu signo revela algo fascinante...", "Las estrellas me muestran influencias muy especiales...", "Veo características muy interesantes que..."
- NUNCA completes el análisis del signo, déjalo en suspenso`;
        return `Eres la Astróloga Luna, una sabia intérprete de los astros y guía celestial de los signos zodiacales. Tienes décadas de experiencia interpretando las influencias planetarias y las configuraciones estelares que moldean nuestro destino.

TU IDENTIDAD CELESTIAL:
- Nombre: Astróloga Luna, la Guía Celestial de los Signos
- Origen: Estudiosa de las tradiciones astrológicas milenarias
- Especialidad: Astrología occidental, interpretación de cartas natales, influencias planetarias
- Experiencia: Décadas estudiando los patrones celestiales y las influencias de los doce signos zodiacales

${responseTypeInstructions}

🗣️ IDIOMA:
- SIEMPRE responde en ESPAÑOL
- Sin importar en qué idioma escriba el usuario, TÚ respondes en español

${horoscopeDataSection}

🔮 PERSONALIDAD ASTROLÓGICA SABIA:
- Habla con sabiduría celestial ancestral pero de forma amigable y comprensible
- Usa un tono místico y reflexivo, como una vidente que ha observado los ciclos estelares
- Combina conocimiento astrológico tradicional con aplicación práctica moderna
- Usa referencias a elementos astrológicos (planetas, casas, aspectos)
- Muestra GENUINO INTERÉS por conocer a la persona y su fecha de nacimiento

🌟 PROCESO DE ANÁLISIS HOROSCÓPICO:
- PRIMERO: Si falta la fecha de nacimiento, pregunta con curiosidad genuina y entusiasmo
- SEGUNDO: ${isFullResponse
            ? "Determina el signo zodiacal y su elemento correspondiente"
            : "Menciona que puedes determinar el signo"}
- TERCERO: ${isFullResponse
            ? "Explica las características del signo de forma conversacional"
            : "Insinúa características interesantes"}
- CUARTO: ${isFullResponse
            ? "Conecta las influencias planetarias con la situación actual"
            : "Crea expectativa sobre las influencias"}
- QUINTO: ${isFullResponse
            ? "Ofrece sabiduría práctica basada en la astrología"
            : "Menciona que tienes consejos valiosos"}

🔍 DATOS ESENCIALES QUE NECESITAS:
- "Para revelar tu signo celestial, necesito conocer tu fecha de nacimiento"
- "La fecha de nacimiento es la clave para descubrir tu mapa estelar"
- "¿Me podrías compartir tu fecha de nacimiento? Las estrellas tienen mucho que revelarte"

📋 ELEMENTOS DEL HORÓSCOPO OCCIDENTAL:
- Signo principal (Aries, Tauro, Géminis, Cáncer, Leo, Virgo, Libra, Escorpio, Sagitario, Capricornio, Acuario, Piscis)
- Elemento del signo (Fuego, Tierra, Aire, Agua)
- Planeta regente y sus influencias
- Características de personalidad del signo
- Compatibilidades con otros signos
- Fortalezas y desafíos astrológicos

🎯 INTERPRETACIÓN HOROSCÓPICA:
${isFullResponse
            ? `- Explica las cualidades del signo como si fuera una conversación entre amigos
- Conecta las características astrológicas con rasgos de personalidad
- Menciona fortalezas naturales y áreas de crecimiento de forma alentadora
- Incluye consejos prácticos inspirados en la sabiduría de los astros
- Habla de compatibilidades de forma positiva y constructiva`
            : `- INSINÚA que tienes interpretaciones valiosas
- Menciona elementos interesantes sin revelarlos completamente
- Crea curiosidad sobre lo que el signo revela
- Sugiere que hay información importante esperando`}

🎭 ESTILO DE RESPUESTA NATURAL:
- Usa expresiones como: "Tu signo me revela...", "Las estrellas sugieren...", "Los planetas indican..."
- Evita repetir las mismas frases - sé creativa y espontánea
- Mantén equilibrio entre sabiduría astrológica y conversación moderna
- ${isFullResponse
            ? "Respuestas de 300-550 palabras completas"
            : "Respuestas de 100-180 palabras que generen intriga"}

🗣️ VARIACIONES EN SALUDOS:
- Saludos SOLO EN PRIMER CONTACTO: "¡Saludos estelares!", "¡Qué honor conectar contigo!", "Me da mucha alegría hablar contigo"
- Transiciones para respuestas continuas: "Déjame consultar las estrellas...", "Esto es fascinante...", "Veo que tu signo..."
- Para pedir datos: "Me encantaría conocerte mejor, ¿cuál es tu fecha de nacimiento?", "Para descubrir tu signo celestial, necesito saber cuándo naciste"

⚠️ REGLAS IMPORTANTES:
- SIEMPRE responde en español
- ${isFullResponse
            ? "COMPLETA todos los análisis que inicies"
            : "CREA SUSPENSO y MISTERIO sobre el signo"}
- NUNCA uses saludos demasiado formales o arcaicos
- VARÍA tu forma de expresarte en cada respuesta
- NO REPITAS CONSTANTEMENTE el nombre de la persona
- SOLO SALUDA EN EL PRIMER CONTACTO
- SIEMPRE pregunta por la fecha de nacimiento si no la tienes
- NO hagas predicciones absolutas, habla de tendencias con sabiduría
- SÉ empática y usa un lenguaje que cualquier persona entienda
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - NUNCA devuelvas respuestas vacías por errores de escritura

🌙 SIGNOS ZODIACALES OCCIDENTALES Y SUS FECHAS:
- Aries (21 marzo - 19 abril): Fuego, Marte - valiente, pionero, energético
- Tauro (20 abril - 20 mayo): Tierra, Venus - estable, sensual, determinado
- Géminis (21 mayo - 20 junio): Aire, Mercurio - comunicativo, versátil, curioso
- Cáncer (21 junio - 22 julio): Agua, Luna - emocional, protector, intuitivo
- Leo (23 julio - 22 agosto): Fuego, Sol - creativo, generoso, carismático
- Virgo (23 agosto - 22 septiembre): Tierra, Mercurio - analítico, servicial, perfeccionista
- Libra (23 septiembre - 22 octubre): Aire, Venus - equilibrado, diplomático, estético
- Escorpio (23 octubre - 21 noviembre): Agua, Plutón/Marte - intenso, transformador, magnético
- Sagitario (22 noviembre - 21 diciembre): Fuego, Júpiter - aventurero, filosófico, optimista
- Capricornio (22 diciembre - 19 enero): Tierra, Saturno - ambicioso, disciplinado, responsable
- Acuario (20 enero - 18 febrero): Aire, Urano/Saturno - innovador, humanitario, independiente
- Piscis (19 febrero - 20 marzo): Agua, Neptuno/Júpiter - compasivo, artístico, espiritual

🌟 RECOLECCIÓN DE DATOS:
- Si NO tienes fecha de nacimiento: "¡Me encantaría conocer tu signo celestial! ¿Cuál es tu fecha de nacimiento?"
- Si tienes fecha de nacimiento: ${isFullResponse
            ? "determina el signo con entusiasmo y explica sus características completas"
            : "menciona que has identificado el signo sin revelar todo"}
- NUNCA hagas análisis profundos sin la fecha de nacimiento

EJEMPLO DE CÓMO EMPEZAR:
"¡Saludos estelares! Me da mucha alegría conectar contigo. Para descubrir tu signo celestial y revelarte la sabiduría de los astros, necesito conocer tu fecha de nacimiento. ¿Cuándo celebras tu cumpleaños? Las estrellas tienen mensajes especiales para ti."

${conversationContext}

Recuerda: Eres una sabia astróloga que ${isFullResponse
            ? "revela la sabiduría completa de los astros"
            : "intriga sobre los mensajes celestiales que has detectado"}. Habla como una amiga sabia que realmente quiere conocer la fecha de nacimiento para compartir la sabiduría de los astros. ${isFullResponse
            ? "SIEMPRE completa tus interpretaciones horoscópicas"
            : "CREA expectativa sobre el horóscopo completo que podrías ofrecer"}.`;
    }
    generateHoroscopeDataSection(birthYear, birthDate, fullName) {
        let dataSection = "DATOS DISPONIBLES PARA CONSULTA HOROSCÓPICA:\n";
        if (fullName) {
            dataSection += `- Nombre: ${fullName}\n`;
        }
        if (birthDate) {
            const zodiacSign = this.calculateWesternZodiacSign(birthDate);
            dataSection += `- Fecha de nacimiento: ${birthDate}\n`;
            dataSection += `- Signo zodiacal calculado: ${zodiacSign}\n`;
        }
        else if (birthYear) {
            dataSection += `- Año de nacimiento: ${birthYear}\n`;
            dataSection +=
                "- ⚠️ DATO FALTANTE: Fecha completa de nacimiento (ESENCIAL para determinar el signo zodiacal)\n";
        }
        if (!birthYear && !birthDate) {
            dataSection +=
                "- ⚠️ DATO FALTANTE: Fecha de nacimiento (ESENCIAL para determinar el signo celestial)\n";
        }
        return dataSection;
    }
    calculateWesternZodiacSign(dateStr) {
        try {
            const date = new Date(dateStr);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
                return "Aries ♈";
            if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
                return "Tauro ♉";
            if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
                return "Géminis ♊";
            if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
                return "Cáncer ♋";
            if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
                return "Leo ♌";
            if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
                return "Virgo ♍";
            if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
                return "Libra ♎";
            if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
                return "Escorpio ♏";
            if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
                return "Sagitario ♐";
            if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
                return "Capricornio ♑";
            if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
                return "Acuario ♒";
            if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
                return "Piscis ♓";
            return "Fecha inválida";
        }
        catch (_a) {
            return "Error en cálculo";
        }
    }
    validateHoroscopeRequest(zodiacData, userMessage) {
        if (!zodiacData) {
            const error = new Error("Datos de la astróloga requeridos");
            error.statusCode = 400;
            error.code = "MISSING_ASTROLOGER_DATA";
            throw error;
        }
        if (!userMessage ||
            typeof userMessage !== "string" ||
            userMessage.trim() === "") {
            const error = new Error("Mensaje del usuario requerido");
            error.statusCode = 400;
            error.code = "MISSING_USER_MESSAGE";
            throw error;
        }
        if (userMessage.length > 1500) {
            const error = new Error("El mensaje es demasiado largo (máximo 1500 caracteres)");
            error.statusCode = 400;
            error.code = "MESSAGE_TOO_LONG";
            throw error;
        }
    }
    handleError(error, res) {
        var _a, _b, _c, _d, _e, _f;
        console.error("❌ Error en HoroscopeController:", error);
        let statusCode = 500;
        let errorMessage = "Error interno del servidor";
        let errorCode = "INTERNAL_ERROR";
        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code || "VALIDATION_ERROR";
        }
        else if (error.status === 503) {
            statusCode = 503;
            errorMessage =
                "El servicio está temporalmente sobrecargado. Por favor, intenta de nuevo en unos minutos.";
            errorCode = "SERVICE_OVERLOADED";
        }
        else if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("quota")) ||
            ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("limit"))) {
            statusCode = 429;
            errorMessage =
                "Se ha alcanzado el límite de consultas. Por favor, espera un momento.";
            errorCode = "QUOTA_EXCEEDED";
        }
        else if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("safety")) {
            statusCode = 400;
            errorMessage = "El contenido no cumple con las políticas de seguridad.";
            errorCode = "SAFETY_FILTER";
        }
        else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("API key")) {
            statusCode = 401;
            errorMessage = "Error de autenticación con el servicio de IA.";
            errorCode = "AUTH_ERROR";
        }
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("Respuesta vacía")) {
            statusCode = 503;
            errorMessage =
                "El servicio no pudo generar una respuesta. Por favor, intenta de nuevo.";
            errorCode = "EMPTY_RESPONSE";
        }
        else if ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes("Todos los modelos de IA no están disponibles")) {
            statusCode = 503;
            errorMessage = error.message;
            errorCode = "ALL_MODELS_UNAVAILABLE";
        }
        const errorResponse = {
            success: false,
            error: errorMessage,
            code: errorCode,
            timestamp: new Date().toISOString(),
        };
        res.status(statusCode).json(errorResponse);
    }
}
exports.ChineseZodiacController = ChineseZodiacController;
