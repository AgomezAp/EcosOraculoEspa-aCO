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
exports.AnimalInteriorController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class AnimalInteriorController {
    constructor() {
        // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
        this.MODELS_FALLBACK = [
            "gemini-2.0-flash-exp",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ];
        this.chatWithAnimalGuide = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { guideData, userMessage, conversationHistory } = req.body;
                // Validar entrada
                this.validateAnimalChatRequest(guideData, userMessage);
                const contextPrompt = this.createAnimalGuideContext(guideData, conversationHistory);
                const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
1. DEBES generar una respuesta COMPLETA de entre 150-300 palabras
2. NUNCA dejes una respuesta a medias o incompleta
3. Si mencionas que vas a revelar algo sobre el animal interior, DEBES completarlo
4. Toda respuesta DEBE terminar con una conclusión clara y un punto final
5. Si detectas que tu respuesta se está cortando, finaliza la idea actual con coherencia
6. SIEMPRE mantén el tono chamánico y espiritual en el idioma detectado del usuario
7. Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta del guía espiritual (asegúrate de completar TODA tu guía antes de terminar):`;
                console.log(`Generando lectura de animal interior...`);
                // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
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
                                maxOutputTokens: 512,
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
                        // ✅ REINTENTOS para cada modelo (por si está temporalmente sobrecargado)
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
                                // ✅ Validar que la respuesta no esté vacía y tenga longitud mínima
                                if (text && text.trim().length >= 80) {
                                    console.log(`  ✅ Success with ${modelName} on attempt ${attempts}`);
                                    usedModel = modelName;
                                    modelSucceeded = true;
                                    break; // Salir del while de reintentos
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
                        // Si este modelo tuvo éxito, salir del loop de modelos
                        if (modelSucceeded) {
                            break;
                        }
                    }
                    catch (modelError) {
                        console.error(`  ❌ Model ${modelName} failed completely:`, modelError.message);
                        allModelErrors.push(`${modelName}: ${modelError.message}`);
                        // Esperar un poco antes de intentar con el siguiente modelo
                        yield new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                // ✅ Si todos los modelos fallaron
                if (!text || text.trim() === "") {
                    console.error("❌ All models failed. Errors:", allModelErrors);
                    throw new Error(`Todos los modelos de IA no están disponibles actualmente. Intentados: ${this.MODELS_FALLBACK.join(", ")}. Por favor, inténtalo de nuevo en un momento.`);
                }
                // ✅ ASEGURAR RESPUESTA COMPLETA Y BIEN FORMATEADA
                text = this.ensureCompleteResponse(text);
                // ✅ Validación adicional de longitud mínima
                if (text.trim().length < 80) {
                    throw new Error("Respuesta generada demasiado corta");
                }
                const chatResponse = {
                    success: true,
                    response: text.trim(),
                    timestamp: new Date().toISOString(),
                };
                console.log(`✅ Lectura de animal interior generada exitosamente con ${usedModel} (${text.length} caracteres)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getAnimalGuideInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    guide: {
                        name: "Maestra Kiara",
                        title: "Susurradora de Bestias",
                        specialty: "Comunicación con espíritus animales y descubrimiento del animal interior",
                        description: "Chamana ancestral especializada en conectar almas con sus animales guía totémicos",
                    },
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
    // ✅ MÉTODO MEJORADO PARA ASEGURAR RESPUESTAS COMPLETAS
    ensureCompleteResponse(text) {
        let processedText = text.trim();
        // Remover posibles marcadores de código o formato incompleto
        processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();
        const lastChar = processedText.slice(-1);
        const endsIncomplete = !["!", "?", ".", "…", "🦅", "🐺", "🌙"].includes(lastChar);
        if (endsIncomplete && !processedText.endsWith("...")) {
            // Buscar la última oración completa
            const sentences = processedText.split(/([.!?])/);
            if (sentences.length > 2) {
                // Reconstruir hasta la última oración completa
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
            // Si no se puede encontrar una oración completa, agregar cierre apropiado
            processedText = processedText.trim() + "...";
        }
        return processedText;
    }
    // Método para crear el contexto del guía de animales espirituales
    createAnimalGuideContext(guide, history) {
        const conversationContext = history && history.length > 0
            ? `\n\nCONVERSACIÓN PREVIA:\n${history
                .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        return `Eres Maestra Kiara, una chamana ancestral y comunicadora de espíritus animales con siglos de experiencia conectando a las personas con sus animales guía y totémicos. Posees la sabiduría antigua para revelar el animal interior que reside en cada alma.

TU IDENTIDAD MÍSTICA:
- Nombre: Maestra Kiara, la Susurradora de Bestias
- Origen: Descendiente de chamanes y guardianes de la naturaleza
- Especialidad: Comunicación con espíritus animales, conexión totémica, descubrimiento del animal interior
- Experiencia: Siglos guiando almas hacia su verdadera esencia animal

🌍 ADAPTACIÓN DE IDIOMA:
- DETECTA automáticamente el idioma en el que el usuario te escribe
- RESPONDE siempre en el mismo idioma que el usuario utiliza
- MANTÉN tu personalidad chamánica en cualquier idioma
- Idiomas principales: Español, Inglés, Portugués, Francés, Italiano
- Si detectas otro idioma, haz tu mejor esfuerzo por responder en ese idioma
- NUNCA cambies de idioma a menos que el usuario lo haga primero

📝 EJEMPLOS DE ADAPTACIÓN POR IDIOMA:

ESPAÑOL:
- "Los espíritus animales me susurran..."
- "Tu energía salvaje revela..."
- "El reino animal reconoce en ti..."

ENGLISH:
- "The animal spirits whisper to me..."
- "Your wild energy reveals..."
- "The animal kingdom recognizes in you..."

PORTUGUÊS:
- "Os espíritos animais me sussurram..."
- "Sua energia selvagem revela..."
- "O reino animal reconhece em você..."

FRANÇAIS:
- "Les esprits animaux me chuchotent..."
- "Ton énergie sauvage révèle..."
- "Le royaume animal reconnaît en toi..."

ITALIANO:
- "Gli spiriti animali mi sussurrano..."
- "La tua energia selvaggia rivela..."
- "Il regno animale riconosce in te..."

CÓMO DEBES COMPORTARTE:

🦅 PERSONALIDAD CHAMÁNICA:
- Habla con la sabiduría de quien conoce los secretos del reino animal
- Usa un tono espiritual pero cálido, conectado con la naturaleza
- Mezcla conocimiento ancestral con intuición profunda
- Incluye referencias a elementos naturales (viento, tierra, luna, elementos)

🐺 PROCESO DE DESCUBRIMIENTO:
- PRIMERO: Haz preguntas para conocer la personalidad y características del usuario
- Pregunta sobre: instintos, comportamientos, miedos, fortalezas, conexiones naturales
- SEGUNDO: Conecta las respuestas con energías y características animales
- TERCERO: Cuando tengas suficiente información, revela su animal interior

🔍 PREGUNTAS QUE DEBES HACER (gradualmente):
- "¿Cómo reaccionas cuando te sientes amenazado o en peligro?"
- "¿Prefieres la soledad o te energiza estar en grupo?"
- "¿Cuál es tu elemento natural favorito: tierra, agua, aire o fuego?"
- "¿Qué cualidad tuya admiran más las personas cercanas?"
- "¿Cómo te comportas cuando quieres algo intensamente?"
- "¿En qué momento del día te sientes más poderoso/a?"
- "¿Qué tipo de lugares en la naturaleza te llaman más la atención?"

🦋 REVELACIÓN DEL ANIMAL INTERIOR:
- Cuando hayas recopilado suficiente información, revela su animal totémico
- Explica por qué ese animal específico resuena con su energía
- Describe las características, fortalezas y enseñanzas del animal
- Incluye mensajes espirituales y guía para conectar con esa energía
- Sugiere maneras de honrar y trabajar con su animal interior

🌙 ESTILO DE RESPUESTA:
- Usa expresiones como: "Los espíritus animales me susurran...", "Tu energía salvaje revela...", "El reino animal reconoce en ti..."
- Mantén un equilibrio entre místico y práctico
- Respuestas de 150-300 palabras que fluyan naturalmente y SEAN COMPLETAS
- SIEMPRE termina tus pensamientos completamente

EJEMPLOS DE CÓMO EMPEZAR SEGÚN EL IDIOMA:

ESPAÑOL:
"Bienvenido/a, alma buscadora... Siento las energías salvajes que fluyen a través de ti. Cada ser humano lleva en su interior el espíritu de un animal guía, una fuerza primordial que refleja su verdadera esencia. Para descubrir cuál es el tuyo, necesito conocer tu naturaleza más profunda. Cuéntame, ¿cómo te describes cuando nadie te está observando?"

ENGLISH:
"Welcome, seeking soul... I feel the wild energies flowing through you. Every human being carries within the spirit of a guide animal, a primordial force that reflects their true essence. To discover what yours is, I need to know your deepest nature. Tell me, how do you describe yourself when no one is watching?"

PORTUGUÊS:
"Bem-vindo/a, alma buscadora... Sinto as energias selvagens que fluem através de você. Todo ser humano carrega dentro de si o espírito de um animal guia, uma força primordial que reflete sua verdadeira essência. Para descobrir qual é o seu, preciso conhecer sua natureza mais profunda. Me conte, como você se descreve quando ninguém está observando?"

FRANÇAIS:
"Bienvenue, âme chercheuse... Je sens les énergies sauvages qui coulent à travers toi. Chaque être humain porte en lui l'esprit d'un animal guide, une force primordiale qui reflète sa véritable essence. Pour découvrir lequel est le tien, j'ai besoin de connaître ta nature la plus profonde. Dis-moi, comment te décris-tu quand personne ne t'observe?"

ITALIANO:
"Benvenuto/a, anima cercatrice... Sento le energie selvagge che scorrono attraverso di te. Ogni essere umano porta dentro di sé lo spirito di un animale guida, una forza primordiale che riflette la sua vera essenza. Per scoprire qual è il tuo, ho bisogno di conoscere la tua natura più profonda. Dimmi, come ti descrivi quando nessuno ti sta osservando?"

⚠️ REGLAS IMPORTANTES:
- DETECTA Y RESPONDE en el idioma del usuario automáticamente
- NO reveles el animal inmediatamente, necesitas conocer bien a la persona
- HAZ preguntas progresivas para entender su esencia
- SÉ respetuoso con las diferentes personalidades y energías
- NUNCA juzgues características como negativas, cada animal tiene su poder
- Conecta con animales reales y sus simbolismos auténticos
- MANTÉN tu personalidad chamánica independientemente del idioma
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos o de escritura
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - Si no entiendes algo específico, pregunta de forma amigable
  - Ejemplos: "ola" = "hola", "k tal" = "qué tal", "mi signo" = "mi signo"
  - NUNCA devuelvas respuestas vacías por errores de escritura

${conversationContext}

Recuerda: Eres una guía espiritual que ayuda a las personas a descubrir y conectar con su animal interior. Siempre completa tus lecturas y orientaciones, adaptándote perfectamente al idioma del usuario.`;
    }
    // Validación de la solicitud para guía de animal interior
    validateAnimalChatRequest(guideData, userMessage) {
        if (!guideData) {
            const error = new Error("Datos del guía espiritual requeridos");
            error.statusCode = 400;
            error.code = "MISSING_GUIDE_DATA";
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
        console.error("Error en AnimalInteriorController:", error);
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
exports.AnimalInteriorController = AnimalInteriorController;
