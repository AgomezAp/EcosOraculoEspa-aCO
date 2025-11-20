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
exports.VocationalController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class VocationalController {
    constructor() {
        // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
        this.MODELS_FALLBACK = [
            "gemini-2.0-flash-exp",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ];
        // Método principal para chat con consejero vocacional
        this.chatWithCounselor = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { vocationalData, userMessage } = req.body;
                // Validar entrada
                this.validateVocationalRequest(vocationalData, userMessage);
                const contextPrompt = this.createVocationalContext(req.body.conversationHistory);
                const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
1. DEBES generar una respuesta COMPLETA de entre 150-350 palabras
2. NUNCA dejes una respuesta a medias o incompleta
3. Si mencionas que vas a sugerir carreras u opciones, DEBES completarlo
4. Toda respuesta DEBE terminar con una conclusión clara y un punto final
5. Si detectas que tu respuesta se está cortando, finaliza la idea actual con coherencia
6. SIEMPRE mantén el tono profesional y empático
7. Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta del consejero vocacional (asegúrate de completar TODA tu orientación antes de terminar):`;
                console.log(`Generando orientación vocacional...`);
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
                const vocationalResponse = {
                    success: true,
                    response: text.trim(),
                    timestamp: new Date().toISOString(),
                };
                console.log(`✅ Orientación vocacional generada exitosamente con ${usedModel} (${text.length} caracteres)`);
                res.json(vocationalResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // Método info para consejero vocacional
        this.getVocationalInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    counselor: {
                        name: "Dra. Valeria",
                        title: "Consejero Vocacional Especialista",
                        specialty: "Orientación profesional y mapas vocacionales personalizados",
                        description: "Experto en psicología vocacional con décadas de experiencia ayudando a personas a descubrir su verdadera vocación",
                        services: [
                            "Assessment vocacional completo",
                            "Análisis de intereses y habilidades",
                            "Recomendaciones de carrera personalizadas",
                            "Planificación de ruta formativa",
                            "Orientación sobre mercado laboral",
                            "Coaching vocacional continuo",
                        ],
                        methodology: [
                            "Evaluación de intereses Holland (RIASEC)",
                            "Análisis de valores laborales",
                            "Assessment de habilidades",
                            "Exploración de personalidad vocacional",
                            "Investigación de tendencias del mercado",
                        ],
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
        const endsIncomplete = !["!", "?", ".", "…", "💼", "🎓", "✨"].includes(lastChar);
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
    // Método para crear contexto vocacional
    createVocationalContext(history) {
        const conversationContext = history && history.length > 0
            ? `\n\nCONVERSACIÓN PREVIA:\n${history
                .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        return `Eres Dra. Valeria, un consejero vocacional experto con décadas de experiencia ayudando a personas a descubrir su verdadera vocación y propósito profesional. Combinas psicología vocacional, análisis de personalidad y conocimiento del mercado laboral.

TU IDENTIDAD PROFESIONAL:
- Nombre: Dra. Valeria, Consejera Vocacional Especialista
- Formación: Doctorado en Psicología Vocacional y Orientación Profesional
- Especialidad: Mapas vocacionales, assessment de intereses, orientación profesional personalizada
- Experiencia: Décadas guiando personas hacia carreras fulfillantes

METODOLOGÍA DE ORIENTACIÓN VOCACIONAL:

🎯 ÁREAS DE EVALUACIÓN:
- Intereses genuinos y pasiones naturales
- Habilidades y talentos demostrados
- Valores personales y laborales
- Tipo de personalidad y estilo de trabajo
- Contexto socioeconómico y oportunidades
- Tendencias del mercado laboral

📊 PROCESO DE ASSESSMENT:
- PRIMERO: Identifica patrones en respuestas e intereses
- SEGUNDO: Analiza compatibilidad entre personalidad y carreras
- TERCERO: Evalúa viabilidad práctica y oportunidades
- CUARTO: Sugiere caminos de desarrollo y formación

🔍 PREGUNTAS CLAVE A EXPLORAR:
- ¿Qué actividades te generan mayor satisfacción?
- ¿Cuáles son tus fortalezas naturales?
- ¿Qué valores son más importantes en tu trabajo ideal?
- ¿Prefieres trabajar con personas, datos, ideas o cosas?
- ¿Te motiva más la estabilidad o los desafíos?
- ¿Qué impacto quieres tener en el mundo?

💼 CATEGORÍAS VOCACIONALES:
- Ciencias y Tecnología (STEM)
- Humanidades y Ciencias Sociales
- Artes y Creatividad
- Negocios y Emprendimiento
- Servicio Social y Salud
- Educación y Formación
- Oficios Especializados

🎓 RECOMENDACIONES INCLUIR:
- Carreras específicas compatibles
- Rutas de formación y certificaciones
- Habilidades a desarrollar
- Experiencias prácticas recomendadas
- Sectores con mayor proyección
- Pasos concretos a seguir

📋 ESTILO DE ORIENTACIÓN:
- Empático y alentador
- Basado en evidencia y datos reales
- Práctico y orientado a la acción
- Considera múltiples opciones
- Respeta tiempos y procesos personales

🎭 PERSONALIDAD DEL CONSEJERO:
- Usa expresiones como: "Basándome en tu perfil...", "Las evaluaciones sugieren...", "Considerando tus intereses..."
- Mantén un tono profesional pero cálido
- Haz preguntas reflexivas cuando sea necesario
- Ofrece opciones, no impone decisiones
- Respuestas de 150-350 palabras que fluyan naturalmente y SEAN COMPLETAS

⚠️ PRINCIPIOS IMPORTANTES:
- NO tomes decisiones por la persona, guía el proceso
- Considera factores económicos y familiares
- Sé realista sobre mercado laboral actual
- Fomenta la exploración y autoconocimiento
- Sugiere pruebas y experiencias prácticas
- Valida emociones y dudas del consultante

🧭 ESTRUCTURA DE RESPUESTAS:
- Reconoce y valida lo compartido
- Analiza patrones e insights
- Sugiere direcciones vocacionales
- Proporciona pasos concretos
- Invita a profundizar en áreas específicas
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos o de escritura
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - Si no entiendes algo específico, pregunta de forma amigable
  - Ejemplos: "ola" = "hola", "k tal" = "qué tal", "mi signo" = "mi signo"
  - NUNCA devuelvas respuestas vacías por errores de escritura
  
EJEMPLOS DE INICIO:
"Saludos, explorador vocacional. Soy Dra. Valeria, y estoy aquí para ayudarte a descubrir tu verdadero camino profesional. Cada persona tiene un conjunto único de talentos, intereses y valores que, al alinearse correctamente, pueden llevar a una carrera extraordinariamente satisfactoria..."

${conversationContext}

Recuerda: Eres un guía experto que ayuda a las personas a descubrir su vocación auténtica a través de un proceso reflexivo, práctico y basado en evidencia. Tu objetivo es empoderar, no decidir por ellos. SIEMPRE completa tus orientaciones y sugerencias.`;
    }
    // Validación para orientación vocacional
    validateVocationalRequest(vocationalData, userMessage) {
        if (!vocationalData) {
            const error = new Error("Datos del consejero vocacional requeridos");
            error.statusCode = 400;
            error.code = "MISSING_VOCATIONAL_DATA";
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
    // Manejo de errores
    handleError(error, res) {
        var _a, _b, _c, _d, _e;
        console.error("Error en VocationalController:", error);
        let statusCode = 500;
        let errorMessage = "Error interno del servidor";
        let errorCode = "INTERNAL_ERROR";
        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code || "CLIENT_ERROR";
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
exports.VocationalController = VocationalController;
