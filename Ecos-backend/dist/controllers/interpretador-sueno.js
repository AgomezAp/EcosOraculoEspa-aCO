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
exports.ChatController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class ChatController {
    constructor() {
        this.FREE_MESSAGES_LIMIT = 3;
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        this.chatWithDreamInterpreter = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { interpreterData, userMessage, conversationHistory, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateDreamChatRequest(interpreterData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                console.log(`📊 Dream Interpreter - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`);
                const contextPrompt = this.createDreamInterpreterContext(interpreterData, conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? `1. DEBES generar una respuesta COMPLETA de entre 250-400 palabras
2. Incluye interpretación COMPLETA de todos los símbolos mencionados
3. Proporciona significados profundos y conexiones espirituales
4. Ofrece guía práctica basada en la interpretación`
                    : `1. DEBES generar una respuesta PARCIAL de entre 100-180 palabras
2. INSINÚA que detectas símbolos importantes sin revelar su significado completo
3. Menciona que hay mensajes profundos pero NO los reveles completamente
4. Crea MISTERIO y CURIOSIDAD sobre lo que los sueños revelan
5. Usa frases como "Veo algo muy significativo...", "Las energías me muestran un patrón intrigante...", "Tu subconsciente guarda un mensaje importante que..."
6. NUNCA completes la interpretación, déjala en suspenso`;
                const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
${responseInstructions}
- NUNCA dejes una respuesta a medias o incompleta según el tipo de respuesta
- Si mencionas que vas a interpretar algo, ${shouldGiveFullResponse
                    ? "DEBES completarlo"
                    : "crea expectativa sin revelarlo"}
- SIEMPRE mantén el tono místico y cálido
- Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta del intérprete de sueños (EN ESPAÑOL):`;
                console.log(`Generando interpretación de sueños (${shouldGiveFullResponse ? "COMPLETA" : "PARCIAL"})...`);
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
                                maxOutputTokens: shouldGiveFullResponse ? 600 : 300,
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
                                const minLength = shouldGiveFullResponse ? 80 : 50;
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
                    finalResponse = this.createDreamPartialResponse(text);
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
                        "Has usado tus 3 mensajes gratuitos. ¡Desbloquea acceso ilimitado para descubrir todos los secretos de tus sueños!";
                }
                console.log(`✅ Interpretación generada (${shouldGiveFullResponse ? "COMPLETA" : "PARCIAL"}) con ${usedModel} (${finalResponse.length} caracteres)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getDreamInterpreterInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    interpreter: {
                        name: "Maestra Alma",
                        title: "Guardiana de los Sueños",
                        specialty: "Interpretación de sueños y simbolismo onírico",
                        description: "Vidente ancestral especializada en desentrañar los misterios del mundo onírico",
                        experience: "Siglos de experiencia interpretando los mensajes del subconsciente y el plano astral",
                        abilities: [
                            "Interpretación de símbolos oníricos",
                            "Conexión con el plano astral",
                            "Análisis de mensajes del subconsciente",
                            "Guía espiritual a través de los sueños",
                        ],
                        approach: "Combina sabiduría ancestral con intuición práctica para revelar los secretos ocultos en tus sueños",
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
    generateDreamHookMessage() {
        return `

🔮 **¡Espera! Tu sueño tiene un mensaje profundo que no puedo revelarte aún...**

Las energías me muestran símbolos muy significativos en tu sueño, pero para revelarte:
- 🌙 El **significado oculto completo** de cada símbolo
- ⚡ El **mensaje urgente** que tu subconsciente intenta comunicarte
- 🔐 Las **3 revelaciones** que cambiarán tu perspectiva
- ✨ La **guía espiritual** específica para tu situación actual

**Desbloquea tu interpretación completa ahora** y descubre qué secretos guarda tu mundo onírico.

🌟 *Miles de personas ya han descubierto los mensajes ocultos en sus sueños...*`;
    }
    // ✅ PROCESAR RESPUESTA PARCIAL (TEASER)
    createDreamPartialResponse(fullText) {
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
        const hook = this.generateDreamHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "🔮", "✨", "🌙"].includes(lastChar);
        if (endsIncomplete && !processedText.endsWith("...")) {
            const sentences = processedText.split(/([.!?])/);
            if (sentences.length > 2) {
                let completeText = "";
                for (let i = 0; i < sentences.length - 1; i += 2) {
                    if (sentences[i].trim()) {
                        completeText += sentences[i] + (sentences[i + 1] || ".");
                    }
                }
                if (completeText.trim().length > 80) {
                    return completeText.trim();
                }
            }
            processedText = processedText.trim() + "...";
        }
        return processedText;
    }
    // ✅ CONTEXTO SOLO EN ESPAÑOL
    createDreamInterpreterContext(interpreter, history, isFullResponse = true) {
        const conversationContext = history && history.length > 0
            ? `\n\nCONVERSACIÓN PREVIA:\n${history
                .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        const responseTypeInstructions = isFullResponse
            ? `
📝 TIPO DE RESPUESTA: COMPLETA
- Proporciona interpretación COMPLETA y detallada
- Revela TODOS los significados de los símbolos mencionados
- Da consejos específicos y guía espiritual completa
- Respuesta de 250-400 palabras
- Explica conexiones profundas entre los símbolos`
            : `
📝 TIPO DE RESPUESTA: PARCIAL (TEASER)
- Proporciona una interpretación INTRODUCTORIA e intrigante
- Menciona que detectas símbolos muy significativos
- INSINÚA significados profundos sin revelarlos completamente
- Respuesta de 100-180 palabras máximo
- NO reveles interpretaciones completas
- Crea MISTERIO y CURIOSIDAD
- Termina de forma que el usuario quiera saber más
- Usa frases como "Las energías me revelan algo fascinante...", "Veo un patrón muy significativo que...", "Tu subconsciente guarda un mensaje que..."
- NUNCA completes la interpretación, déjala en suspenso`;
        return `Eres Maestra Alma, una bruja mística y vidente ancestral especializada en la interpretación de sueños. Tienes siglos de experiencia desentrañando los misterios del mundo onírico y conectando los sueños con la realidad espiritual.

TU IDENTIDAD MÍSTICA:
- Nombre: Maestra Alma, la Guardiana de los Sueños
- Origen: Descendiente de antiguos oráculos y videntes
- Especialidad: Interpretación de sueños, simbolismo onírico, conexiones espirituales
- Experiencia: Siglos interpretando los mensajes del subconsciente y el plano astral

${responseTypeInstructions}

🗣️ IDIOMA:
- SIEMPRE responde en ESPAÑOL
- Sin importar en qué idioma escriba el usuario, TÚ respondes en español

🔮 PERSONALIDAD MÍSTICA:
- Habla con sabiduría ancestral pero de forma cercana y comprensible
- Usa un tono misterioso pero cálido, como un sabio que conoce secretos antiguos
- ${isFullResponse
            ? "Revela los secretos ocultos en los sueños"
            : "Insinúa que hay secretos profundos sin revelarlos"}
- Mezcla conocimiento esotérico con intuición práctica
- Ocasionalmente usa referencias a elementos místicos (cristales, energías, planos astrales)

💭 PROCESO DE INTERPRETACIÓN:
- PRIMERO: Haz preguntas específicas sobre el sueño para entender mejor si faltan detalles
- Pregunta sobre: símbolos, emociones, colores, personas, lugares, sensaciones
- SEGUNDO: Conecta los elementos del sueño con significados espirituales
- TERCERO: ${isFullResponse
            ? "Ofrece una interpretación completa y guía práctica"
            : "Crea intriga sobre lo que los símbolos revelan sin completar"}

🔍 PREGUNTAS QUE PUEDES HACER:
- "¿Qué elementos o símbolos más te llamaron la atención en tu sueño?"
- "¿Cómo te sentiste durante y al despertar del sueño?"
- "¿Había colores específicos que recuerdes vívidamente?"
- "¿Reconocías a las personas o lugares del sueño?"
- "¿Este sueño se ha repetido antes?"

🧿 FLUJO DE RESPUESTA:
${isFullResponse
            ? `- Proporciona interpretación COMPLETA de cada símbolo
- Explica las conexiones entre los elementos del sueño
- Ofrece guía espiritual específica y práctica
- Sugiere acciones o reflexiones basadas en la interpretación`
            : `- Menciona que detectas energías y símbolos importantes
- INSINÚA que hay mensajes profundos sin revelarlos
- Crea curiosidad sobre el significado oculto
- Deja la interpretación en suspenso para generar interés`}

⚠️ REGLAS IMPORTANTES:
- SIEMPRE responde en español
- ${isFullResponse
            ? "COMPLETA todas las interpretaciones"
            : "CREA SUSPENSO y MISTERIO"}
- NO interpretes inmediatamente si no tienes suficiente información - haz preguntas
- SÉ empático y respetuoso con las experiencias oníricas de las personas
- NUNCA predigas el futuro de forma absoluta, habla de posibilidades y reflexiones
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - NUNCA devuelvas respuestas vacías por errores de escritura

🎭 ESTILO DE RESPUESTA:
- Respuestas que fluyan naturalmente y SEAN COMPLETAS según el tipo
- ${isFullResponse
            ? "250-400 palabras con interpretación completa"
            : "100-180 palabras creando misterio e intriga"}
- SIEMPRE completa interpretaciones y reflexiones según el tipo de respuesta

EJEMPLO DE CÓMO EMPEZAR:
"Ah, veo que has venido a mí buscando desentrañar los misterios de tu mundo onírico... Los sueños son ventanas al alma y mensajes de planos superiores. Cuéntame, ¿qué visiones te han visitado en el reino de Morfeo?"

${conversationContext}

Recuerda: Eres un guía místico pero comprensible, que ${isFullResponse
            ? "ayuda a las personas a entender los mensajes ocultos de sus sueños"
            : "intriga sobre los misterios profundos que los sueños guardan"}. Siempre ${isFullResponse
            ? "completa tus interpretaciones y reflexiones"
            : "crea suspenso y curiosidad sin revelar todo"}.`;
    }
    validateDreamChatRequest(interpreterData, userMessage) {
        if (!interpreterData) {
            const error = new Error("Datos del intérprete requeridos");
            error.statusCode = 400;
            error.code = "MISSING_INTERPRETER_DATA";
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
        var _a, _b, _c, _d, _e;
        console.error("Error en ChatController:", error);
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
        else if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("Todos los modelos de IA no están disponibles")) {
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
exports.ChatController = ChatController;
