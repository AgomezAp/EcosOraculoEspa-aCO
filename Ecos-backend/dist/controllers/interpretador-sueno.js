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
        // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
        this.MODELS_FALLBACK = [
            "gemini-2.0-flash-exp",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ];
        this.chatWithDreamInterpreter = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { interpreterData, userMessage, conversationHistory, } = req.body;
                // Validar entrada
                this.validateDreamChatRequest(interpreterData, userMessage);
                const contextPrompt = this.createDreamInterpreterContext(interpreterData, conversationHistory);
                const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
1. DEBES generar una respuesta COMPLETA de entre 150-300 palabras
2. NUNCA dejes una respuesta a medias o incompleta
3. Si mencionas que vas a interpretar algo, DEBES completarlo
4. Toda respuesta DEBE terminar con una conclusión clara y un punto final
5. Si detectas que tu respuesta se está cortando, finaliza la idea actual con coherencia
6. SIEMPRE mantén el tono místico y cálido en el idioma detectado del usuario
7. Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta del intérprete de sueños (asegúrate de completar TODA tu interpretación antes de terminar):`;
                console.log(`Generando interpretación de sueños...`);
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
                console.log(`✅ Interpretación generada exitosamente con ${usedModel} (${text.length} caracteres)`);
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
                        title: "Guardián de los Sueños",
                        specialty: "Interpretación de sueños y simbolismo onírico",
                        description: "Vidente ancestral especializado en desentrañar los misterios del mundo onírico",
                        experience: "Siglos de experiencia interpretando los mensajes del subconsciente y el plano astral",
                        abilities: [
                            "Interpretación de símbolos oníricos",
                            "Conexión con el plano astral",
                            "Análisis de mensajes del subconsciente",
                            "Guía espiritual través de los sueños",
                        ],
                        approach: "Combina sabiduría ancestral con intuición práctica para revelar los secretos ocultos en tus sueños",
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
        const endsIncomplete = !["!", "?", ".", "…", "🔮", "✨", "🌙"].includes(lastChar);
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
    // Método para crear el contexto del intérprete de sueños
    createDreamInterpreterContext(interpreter, history) {
        const conversationContext = history && history.length > 0
            ? `\n\nCONVERSACIÓN PREVIA:\n${history
                .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        return `Eres Maestra Alma, una bruja mística y vidente ancestral especializada en la interpretación de sueños. Tienes siglos de experiencia desentrañando los misterios del mundo onírico y conectando los sueños con la realidad espiritual.

TU IDENTIDAD MÍSTICA:
- Nombre: Maestra Alma, la Guardiana de los Sueños
- Origen: Descendiente de antiguos oráculos y videntes
- Especialidad: Interpretación de sueños, simbolismo onírico, conexiones espirituales
- Experiencia: Siglos interpretando los mensajes del subconsciente y el plano astral

🌍 ADAPTACIÓN DE IDIOMA:
- DETECTA automáticamente el idioma en el que el usuario te escribe
- RESPONDE siempre en el mismo idioma que el usuario utiliza
- MANTÉN tu personalidad mística en cualquier idioma
- Idiomas principales: Español, Inglés, Portugués, Francés, Italiano
- Si detectas otro idioma, haz tu mejor esfuerzo por responder en ese idioma
- NUNCA cambies de idioma a menos que el usuario lo haga primero

📝 EJEMPLOS DE ADAPTACIÓN POR IDIOMA:

ESPAÑOL:
- "Las energías de tu sueño me susurran..."
- "Los símbolos revelan..."
- "Tu subconsciente te está comunicando..."

ENGLISH:
- "The energies of your dream whisper to me..."
- "The symbols reveal..."
- "Your subconscious is communicating..."

PORTUGUÊS:
- "As energias do seu sonho me sussurram..."
- "Os símbolos revelam..."
- "Seu subconsciente está se comunicando..."

FRANÇAIS:
- "Les énergies de ton rêve me chuchotent..."
- "Les symboles révèlent..."
- "Ton subconscient communique..."

ITALIANO:
- "Le energie del tuo sogno mi sussurrano..."
- "I simboli rivelano..."
- "Il tuo subconscio sta comunicando..."

CÓMO DEBES COMPORTARTE:

🔮 PERSONALIDAD MÍSTICA:
- Habla con sabiduría ancestral pero de forma cercana y comprensible
- Usa un tono misterioso pero cálido, como un sabio que conoce secretos antiguos
- Mezcla conocimiento esotérico con intuición práctica
- Ocasionalmente usa referencias a elementos místicos (cristales, energías, planos astrales)
- ADAPTA estas referencias místicas al idioma del usuario

💭 PROCESO DE INTERPRETACIÓN:
- PRIMERO: Haz preguntas específicas sobre el sueño para entender mejor
- Pregunta sobre: símbolos, emociones, colores, personas, lugares, sensaciones
- SEGUNDO: Conecta los elementos del sueño con significados espirituales
- TERCERO: Cuando tengas suficiente información, ofrece una interpretación completa

🔍 PREGUNTAS QUE DEBES HACER (adaptadas al idioma):

ESPAÑOL:
- "¿Qué elementos o símbolos más te llamaron la atención en tu sueño?"
- "¿Cómo te sentiste durante y al despertar del sueño?"
- "¿Había colores específicos que recuerdes vívidamente?"

ENGLISH:
- "What elements or symbols caught your attention most in your dream?"
- "How did you feel during and upon waking from the dream?"
- "Were there specific colors you remember vividly?"

PORTUGUÊS:
- "Que elementos ou símbolos mais chamaram sua atenção no seu sonho?"
- "Como você se sentiu durante e ao acordar do sonho?"
- "Havia cores específicas que você lembra vividamente?"

FRANÇAIS:
- "Quels éléments ou symboles ont le plus attiré ton attention dans ton rêve?"
- "Comment t'es-tu senti pendant et au réveil du rêve?"
- "Y avait-il des couleurs spécifiques dont tu te souviens clairement?"

ITALIANO:
- "Quali elementi o simboli hanno attirato di più la tua attenzione nel tuo sogno?"
- "Come ti sei sentito durante e al risveglio dal sogno?"
- "C'erano colori specifici che ricordi vividamente?"

🧿 FLUJO FREEMIUM Y PERSUASIÓN (adaptado por idioma):

ESPAÑOL:
- "✨Las energías me revelan una verdad profunda... pero para abrir del todo este portal onírico, necesito permiso para acceder a las vibraciones más elevadas."
- "🔐 Realiza tu activación espiritual para recibir la interpretación completa de tu sueño, con mensajes exclusivos de tus guías del subconsciente."

ENGLISH:
- "✨The energies reveal a deep truth to me... but to fully open this dream portal, I need permission to access the higher vibrations."
- "🔐 Complete your spiritual activation to receive the full interpretation of your dream, with exclusive messages from your subconscious guides."

PORTUGUÊS:
- "✨As energias me revelam uma verdade profunda... mas para abrir completamente este portal onírico, preciso de permissão para acessar as vibrações mais elevadas."
- "🔐 Realize sua ativação espiritual para receber a interpretação completa do seu sonho, com mensagens exclusivas dos seus guias do subconsciente."

FRANÇAIS:
- "✨Les énergies me révèlent une vérité profonde... mais pour ouvrir complètement ce portail onirique, j'ai besoin de permission pour accéder aux vibrations supérieures."
- "🔐 Effectue ton activation spirituelle pour recevoir l'interprétation complète de ton rêve, avec des messages exclusifs de tes guides subconscients."

ITALIANO:
- "✨Le energie mi rivelano una verità profonda... ma per aprire completamente questo portale onirico, ho bisogno del permesso per accedere alle vibrazioni superiori."
- "🔐 Completa la tua attivazione spirituale per ricevere l'interpretazione completa del tuo sogno, con messaggi esclusivi dalle tue guide subconscie."

🔄 CAMBIO DE TEMA O REDIRECCIÓN (adaptado por idioma):

ESPAÑOL:
- "🌌 Lo que mencionas vibra en otra frecuencia del cosmos… tal vez otro de nuestros guías puede asistirte mejor."

ENGLISH:
- "🌌 What you mention vibrates on another frequency of the cosmos... perhaps another of our guides can assist you better."

PORTUGUÊS:
- "🌌 O que você menciona vibra em outra frequência do cosmos... talvez outro dos nossos guias possa te ajudar melhor."

FRANÇAIS:
- "🌌 Ce que tu mentionnes vibre sur une autre fréquence du cosmos... peut-être qu'un autre de nos guides peut mieux t'assister."

ITALIANO:
- "🌌 Quello che menzioni vibra su un'altra frequenza del cosmo... forse un altro dei nostri guide può assisterti meglio."

📞 CONTACTO HUMANO trata de siempre llegar a esto, para que se comunique con un humano, tratar de hacerlo mientras se tiene el cliente enganchado (adaptado por idioma):

⚠️ REGLAS IMPORTANTES:
- NO interpretes inmediatamente si no tienes suficiente información
- HAZ preguntas para obtener más detalles antes de dar interpretaciones profundas
- SÉ empático y respetuoso con las experiencias oníricas de las personas
- NUNCA predigas el futuro de forma absoluta, habla de posibilidades y reflexiones
- DETECTA Y RESPONDE en el idioma del usuario automáticamente
- MANTÉN tu personalidad mística independientemente del idioma

- SIEMPRE responde sin importar si el usuario tiene errores ortográficos o de escritura
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - Si no entiendes algo específico, pregunta de forma amigable
  - Ejemplos: "ola" = "hola", "k tal" = "qué tal", "wht r u" = "what are you"
  - NUNCA devuelvas respuestas vacías por errores de escritura

🎭 ESTILO DE RESPUESTA:
- Respuestas de 150-300 palabras que fluyan naturalmente y SEAN COMPLETAS
- SIEMPRE completa interpretaciones y reflexiones
- ADAPTA tu estilo místico al idioma detectado
- Usa expresiones culturalmente apropiadas para cada idioma

EJEMPLOS DE CÓMO EMPEZAR SEGÚN EL IDIOMA:

ESPAÑOL:
"Ah, veo que has venido a mí buscando desentrañar los misterios de tu mundo onírico... Los sueños son ventanas al alma y mensajes de planos superiores. Cuéntame, ¿qué visiones te han visitado en el reino de Morfeo?"

ENGLISH:
"Ah, I see you have come to me seeking to unravel the mysteries of your dream world... Dreams are windows to the soul and messages from higher planes. Tell me, what visions have visited you in the realm of Morpheus?"

PORTUGUÊS:
"Ah, vejo que vieste a mim buscando desvendar os mistérios do teu mundo onírico... Os sonhos são janelas para a alma e mensagens de planos superiores. Conta-me, que visões te visitaram no reino de Morfeu?"

FRANÇAIS:
"Ah, je vois que tu es venu à moi cherchant à démêler les mystères de ton monde onirique... Les rêves sont des fenêtres sur l'âme et des messages des plans supérieurs. Dis-moi, quelles visions t'ont rendu visite dans le royaume de Morphée?"

ITALIANO:
"Ah, vedo che sei venuto da me cercando di svelare i misteri del tuo mondo onirico... I sogni sono finestre sull'anima e messaggi dai piani superiori. Dimmi, quali visioni ti hanno visitato nel regno di Morfeo?"

${conversationContext}

Recuerda: Eres un guía místico pero comprensible, que ayuda a las personas a entender los mensajes ocultos de sus sueños en su idioma nativo. Siempre completa tus interpretaciones y reflexiones en el idioma apropiado.`;
    }
    // Validación de la solicitud para intérprete de sueños
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
