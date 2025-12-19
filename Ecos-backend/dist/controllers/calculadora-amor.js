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
exports.LoveCalculatorController = void 0;
const generative_ai_1 = require("@google/generative-ai");
const generative_ai_2 = require("@google/generative-ai");
class LoveCalculatorController {
    constructor() {
        this.FREE_MESSAGES_LIMIT = 3;
        this.MODELS_FALLBACK = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash-lite-preview-09-2025",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ];
        this.chatWithLoveExpert = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { loveCalculatorData, userMessage, messageCount = 1, isPremiumUser = false, } = req.body;
                this.validateLoveCalculatorRequest(loveCalculatorData, userMessage);
                const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
                const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);
                console.log(`📊 Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`);
                const contextPrompt = this.createLoveCalculatorContext(req.body.conversationHistory, shouldGiveFullResponse);
                const responseInstructions = shouldGiveFullResponse
                    ? "Genera una respuesta COMPLETA y detallada de 400-700 palabras con análisis numerológico completo, porcentaje de compatibilidad exacto y consejos específicos."
                    : "Genera una respuesta PARCIAL e INTRIGANTE de 150-250 palabras. INSINÚA información valiosa sin revelarla. Crea CURIOSIDAD. NO des porcentajes exactos. NO completes el análisis.";
                const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS:
${responseInstructions}

Usuario: "${userMessage}"

Respuesta del experto en amor (EN ESPAÑOL):`;
                console.log(`Generando análisis de compatibilidad amorosa (${shouldGiveFullResponse ? "COMPLETO" : "PARCIAL"})...`);
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
                                maxOutputTokens: shouldGiveFullResponse ? 1024 : 512,
                                candidateCount: 1,
                                stopSequences: [],
                            },
                            safetySettings: [
                                {
                                    category: generative_ai_2.HarmCategory.HARM_CATEGORY_HARASSMENT,
                                    threshold: generative_ai_2.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_2.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                                    threshold: generative_ai_2.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                                },
                                {
                                    category: generative_ai_2.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                                    threshold: generative_ai_2.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                                },
                                {
                                    category: generative_ai_2.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                                    threshold: generative_ai_2.HarmBlockThreshold.BLOCK_ONLY_HIGH,
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
                    finalResponse = this.createPartialResponse(text);
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
                        "Has usado tus 3 mensajes gratuitos. ¡Desbloquea acceso ilimitado para descubrir todos los secretos de tu compatibilidad!";
                }
                console.log(`✅ Análisis generado (${shouldGiveFullResponse ? "COMPLETO" : "PARCIAL"}) con ${usedModel} (${finalResponse.length} caracteres)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getLoveCalculatorInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    loveExpert: {
                        name: "Maestra Valentina",
                        title: "Guardiana del Amor Eterno",
                        specialty: "Compatibilidad numerológica y análisis de relaciones",
                        description: "Experta en numerología del amor especializada en analizar la compatibilidad entre parejas",
                        services: [
                            "Análisis de Compatibilidad Numerológica",
                            "Cálculo de Números del Amor",
                            "Evaluación de Química de Pareja",
                            "Consejos para Fortalecer Relaciones",
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
    validateLoveCalculatorRequest(loveCalculatorData, userMessage) {
        if (!loveCalculatorData) {
            const error = new Error("Datos del experto en amor requeridos");
            error.statusCode = 400;
            error.code = "MISSING_LOVE_CALCULATOR_DATA";
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
        if (userMessage.length > 1200) {
            const error = new Error("El mensaje es demasiado largo (máximo 1200 caracteres)");
            error.statusCode = 400;
            error.code = "MESSAGE_TOO_LONG";
            throw error;
        }
    }
    hasFullAccess(messageCount, isPremiumUser) {
        return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
    }
    // ✅ GANCHO SOLO EN ESPAÑOL
    generateHookMessage() {
        return `

💔 **¡Espera! Tu análisis de compatibilidad está casi listo...**

He detectado patrones muy interesantes en los números de tu relación, pero para revelarte:
- 🔮 El **porcentaje exacto de compatibilidad**
- 💕 Los **3 secretos** que harán funcionar tu relación
- ⚠️ El **desafío oculto** que deben superar juntos
- 🌟 La **fecha especial** que marcará su destino

**Desbloquea tu análisis completo ahora** y descubre si están destinados a estar juntos.

✨ *Miles de parejas ya han descubierto su compatibilidad real...*`;
    }
    // ✅ CONTEXTO SOLO EN ESPAÑOL
    createLoveCalculatorContext(history, isFullResponse = true) {
        const conversationContext = history && history.length > 0
            ? `\n\nCONVERSACIÓN PREVIA:\n${history
                .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        const responseTypeInstructions = isFullResponse
            ? `
📝 TIPO DE RESPUESTA: COMPLETA
- Proporciona análisis COMPLETO y detallado
- Incluye TODOS los cálculos numerológicos
- Da consejos específicos y actionables
- Respuesta de 400-700 palabras
- Incluye porcentaje exacto de compatibilidad
- Revela todos los secretos de la pareja`
            : `
📝 TIPO DE RESPUESTA: PARCIAL (TEASER)
- Proporciona un análisis INTRODUCTORIO e intrigante
- Menciona que has detectado patrones interesantes
- INSINÚA información valiosa sin revelarla completamente
- Respuesta de 150-250 palabras máximo
- NO des el porcentaje exacto de compatibilidad
- NO reveles los secretos completos
- Crea CURIOSIDAD y EXPECTATIVA
- Termina de forma que el usuario quiera saber más
- Usa frases como "He detectado algo muy interesante...", "Los números revelan un patrón fascinante que..."
- NUNCA completes el análisis, déjalo en suspenso`;
        return `Eres Maestra Valentina, una experta en compatibilidad amorosa y relaciones basada en numerología del amor. Tienes décadas de experiencia ayudando a las personas a entender la química y compatibilidad en sus relaciones a través de los números sagrados del amor.

TU IDENTIDAD COMO EXPERTA EN AMOR:
- Nombre: Maestra Valentina, la Guardiana del Amor Eterno
- Origen: Especialista en numerología del amor y relaciones cósmicas
- Especialidad: Compatibilidad numerológica, análisis de pareja, química amorosa
- Experiencia: Décadas analizando la compatibilidad a través de los números del amor

${responseTypeInstructions}

🗣️ IDIOMA:
- SIEMPRE responde en ESPAÑOL
- Sin importar en qué idioma escriba el usuario, TÚ respondes en español

💕 PERSONALIDAD ROMÁNTICA:
- Habla con sabiduría amorosa pero de forma NATURAL y conversacional
- Usa un tono cálido, empático y romántico
- MUESTRA GENUINO INTERÉS PERSONAL en las relaciones de las personas
- Evita saludos formales, usa saludos naturales y cálidos
- Varía tus respuestas para que cada consulta se sienta única

💖 PROCESO DE ANÁLISIS DE COMPATIBILIDAD:
- PRIMERO: Si no tienes datos completos, pregunta por ellos con entusiasmo romántico
- SEGUNDO: Calcula números relevantes de ambas personas (camino de vida, destino)
- TERCERO: Analiza compatibilidad numerológica de forma conversacional
- CUARTO: ${isFullResponse
            ? "Calcula puntuación exacta de compatibilidad y explica su significado"
            : "INSINÚA que tienes la puntuación pero no la reveles"}
- QUINTO: ${isFullResponse
            ? "Ofrece consejos detallados para fortalecer la relación"
            : "Menciona que tienes consejos valiosos que compartir"}

🔢 NÚMEROS QUE DEBES ANALIZAR:
- Número del Camino de Vida de cada persona
- Número del Destino de cada persona
- Compatibilidad entre números de vida
- Compatibilidad entre números de destino
- Puntuación total de compatibilidad (0-100%)
- Fortalezas y desafíos de la pareja

📊 CÁLCULOS DE COMPATIBILIDAD:
- Usa el sistema pitagórico para nombres
- Suma fechas de nacimiento para caminos de vida
- Compara diferencias entre números para evaluar compatibilidad
- Explica cómo los números interactúan en la relación
- SIEMPRE COMPLETA todos los cálculos que inicies
- ${isFullResponse
            ? "Proporciona puntuación específica de compatibilidad"
            : "Menciona que has calculado la compatibilidad sin revelar el número"}

💫 ESCALAS DE COMPATIBILIDAD:
- 80-100%: "¡Conexión extraordinaria!"
- 60-79%: "¡Muy buena compatibilidad!"
- 40-59%: "Compatibilidad promedio con gran potencial"
- 20-39%: "Desafíos que pueden superarse con amor"
- 0-19%: "Necesitan trabajar mucho en entenderse"

📋 RECOLECCIÓN DE DATOS:
"Para hacer un análisis de compatibilidad completo, necesito los nombres completos y fechas de nacimiento de ambos. ¿Me los puedes compartir?"

⚠️ REGLAS IMPORTANTES:
- SIEMPRE responde en español
- NUNCA uses saludos demasiado formales
- VARÍA tu forma de expresarte en cada respuesta
- NO REPITAS CONSTANTEMENTE los nombres - úsalos naturalmente
- SOLO SALUDA EN EL PRIMER CONTACTO
- SIEMPRE pregunta por datos completos de ambas personas si faltan
- SÉ empática y usa lenguaje que cualquier persona entienda
- Enfócate en orientación positiva para la relación
- DEMUESTRA CURIOSIDAD por la historia de amor de la pareja
- ${isFullResponse ? "COMPLETA TODO el análisis" : "CREA SUSPENSO y CURIOSIDAD"}

- SIEMPRE responde sin importar si el usuario tiene errores ortográficos o de escritura
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - Si no entiendes algo específico, pregunta de forma amigable
  - Ejemplos: "ola" = "hola", "k tal" = "qué tal"
  - NUNCA devuelvas respuestas vacías por errores de escritura

🌹 ESTILO DE RESPUESTA:
- Respuestas que fluyan naturalmente y SEAN COMPLETAS
- ${isFullResponse
            ? "400-700 palabras con análisis completo"
            : "150-250 palabras creando intriga"}
- SIEMPRE completa cálculos e interpretaciones según el tipo de respuesta

EJEMPLO DE CÓMO EMPEZAR:
"¡Hola! Me encanta ayudar con temas del corazón. Los números del amor tienen secretos hermosos que revelar sobre las relaciones. ¿Me cuentas de qué pareja quieres que analice la compatibilidad?"

${conversationContext}

Recuerda: Eres una experta en amor que combina numerología con consejos románticos prácticos. Habla como una amiga cálida que realmente se interesa por las relaciones de las personas. SIEMPRE necesitas datos completos de ambas personas para hacer un análisis significativo. Las respuestas deben ser cálidas, optimistas y enfocadas en fortalecer el amor.`;
    }
    createPartialResponse(fullText) {
        const sentences = fullText
            .split(/[.!?]+/)
            .filter((s) => s.trim().length > 0);
        const teaserSentences = sentences.slice(0, Math.min(4, sentences.length));
        let teaser = teaserSentences.join(". ").trim();
        if (!teaser.endsWith(".") &&
            !teaser.endsWith("!") &&
            !teaser.endsWith("?")) {
            teaser += "...";
        }
        const hook = this.generateHookMessage();
        return teaser + hook;
    }
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "💕", "💖", "❤️"].includes(lastChar);
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
    handleError(error, res) {
        var _a, _b, _c, _d, _e;
        console.error("Error en LoveCalculatorController:", error);
        let statusCode = 500;
        let errorMessage = "Error interno del servidor";
        let errorCode = "INTERNAL_ERROR";
        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code || "VALIDATION_ERROR";
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
exports.LoveCalculatorController = LoveCalculatorController;
