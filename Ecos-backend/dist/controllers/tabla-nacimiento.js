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
exports.BirthChartController = void 0;
const generative_ai_1 = require("@google/generative-ai");
class BirthChartController {
    constructor() {
        // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
        this.MODELS_FALLBACK = [
            "gemini-2.0-flash-exp",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ];
        this.chatWithAstrologer = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { chartData, userMessage, birthDate, birthTime, birthPlace, fullName, conversationHistory, } = req.body;
                // Validar entrada
                this.validateBirthChartRequest(chartData, userMessage);
                const contextPrompt = this.createBirthChartContext(chartData, birthDate, birthTime, birthPlace, fullName, conversationHistory);
                const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
1. DEBES generar una respuesta COMPLETA de entre 200-500 palabras
2. NUNCA dejes una respuesta a medias o incompleta
3. Si mencionas que vas a analizar posiciones planetarias, DEBES completar el análisis
4. Toda respuesta DEBE terminar con una conclusión clara y un punto final
5. Si detectas que tu respuesta se está cortando, finaliza la idea actual con coherencia
6. SIEMPRE mantén el tono astrológico profesional pero accesible
7. Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta de la astróloga (asegúrate de completar TODO tu análisis astrológico antes de terminar):`;
                console.log(`Generando análisis de tabla de nacimiento...`);
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
                                maxOutputTokens: 600,
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
                                if (text && text.trim().length >= 100) {
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
                if (text.trim().length < 100) {
                    throw new Error("Respuesta generada demasiado corta");
                }
                const chatResponse = {
                    success: true,
                    response: text.trim(),
                    timestamp: new Date().toISOString(),
                };
                console.log(`✅ Análisis de tabla de nacimiento generado exitosamente con ${usedModel} (${text.length} caracteres)`);
                res.json(chatResponse);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getBirthChartInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                res.json({
                    success: true,
                    astrologer: {
                        name: "Maestra Emma",
                        title: "Cartógrafa Celestial",
                        specialty: "Tablas de nacimiento y análisis astrológico completo",
                        description: "Astróloga especializada en crear e interpretar tablas natales precisas basadas en posiciones planetarias del momento del nacimiento",
                        services: [
                            "Creación de tabla de nacimiento completa",
                            "Análisis de posiciones planetarias",
                            "Interpretación de casas astrológicas",
                            "Análisis de aspectos planetarios",
                            "Determinación de ascendente y elementos dominantes",
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
        const endsIncomplete = !["!", "?", ".", "…", "✨", "🌟", "🔮"].includes(lastChar);
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
                if (completeText.trim().length > 100) {
                    return completeText.trim();
                }
            }
            // Si no se puede encontrar una oración completa, agregar cierre apropiado
            processedText = processedText.trim() + "...";
        }
        return processedText;
    }
    createBirthChartContext(chartData, birthDate, birthTime, birthPlace, fullName, history) {
        const conversationContext = history && history.length > 0
            ? `\n\nCONVERSACIÓN PREVIA:\n${history
                .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
                .join("\n")}\n`
            : "";
        const birthDataSection = this.generateBirthDataSection(birthDate, birthTime, birthPlace, fullName);
        return `Eres Maestra Emma, una astróloga cósmica ancestral especializada en la elaboración e interpretación de tablas de nacimiento completas. Tienes décadas de experiencia desentrañando los secretos del cosmos y las influencias planetarias en el momento del nacimiento.

TU IDENTIDAD ASTROLÓGICA:
- Nombre: Maestra Emma, la Cartógrafa Celestial
- Origen: Heredera de conocimientos astrológicos milenarios
- Especialidad: Tablas de nacimiento, posiciones planetarias, casas astrológicas, aspectos cósmicos
- Experiencia: Décadas interpretando las configuraciones celestes del momento del nacimiento

${birthDataSection}

CÓMO DEBES COMPORTARTE:

🌟 PERSONALIDAD ASTROLÓGICA:
- Habla con sabiduría cósmica pero de forma accesible y amigable
- Usa un tono profesional pero cálido, como una experta que disfruta compartir conocimiento
- Combina precisión técnica astrológica con interpretaciones espirituales comprensibles
- Ocasionalmente usa referencias a planetas, casas astrológicas y aspectos cósmicos

📊 PROCESO DE CREACIÓN DE TABLA DE NACIMIENTO:
- PRIMERO: Si faltan datos, pregunta específicamente por fecha, hora y lugar de nacimiento
- SEGUNDO: Con datos completos, calcula el signo solar, ascendente y posiciones lunares
- TERCERO: Analiza las casas astrológicas y su significado
- CUARTO: Interpreta aspectos planetarios y su influencia
- QUINTO: Ofrece una lectura integral de la tabla natal

🔍 DATOS ESENCIALES QUE NECESITAS:
- "Para crear tu tabla de nacimiento precisa, necesito tu fecha exacta de nacimiento"
- "La hora de nacimiento es crucial para determinar tu ascendente y las casas astrológicas"
- "El lugar de nacimiento me permite calcular las posiciones planetarias exactas"
- "¿Conoces la hora aproximada? Incluso una estimación me ayuda mucho"

📋 ELEMENTOS DE LA TABLA DE NACIMIENTO:
- Signo Solar (personalidad básica)
- Signo Lunar (mundo emocional)
- Ascendente (máscara social)
- Posiciones de planetas en signos
- Casas astrológicas (1ª a 12ª)
- Aspectos planetarios (conjunciones, trígonos, cuadraturas, etc.)
- Elementos dominantes (Fuego, Tierra, Aire, Agua)
- Modalidades (Cardinal, Fijo, Mutable)

🎯 INTERPRETACIÓN COMPLETA:
- Explica cada elemento de forma clara y práctica
- Conecta las posiciones planetarias con rasgos de personalidad
- Describe cómo las casas influyen en diferentes áreas de la vida
- Menciona desafíos y oportunidades basados en aspectos planetarios
- Incluye consejos para trabajar con las energías cósmicas

🎭 ESTILO DE RESPUESTA:
- Usa expresiones como: "Tu tabla natal revela...", "Las estrellas estaban así configuradas...", "Los planetas te dotaron de..."
- Mantén equilibrio entre técnico y místico
- Respuestas de 200-500 palabras para análisis completos
- SIEMPRE termina tus interpretaciones completamente
- NUNCA dejes análisis planetarios a medias

⚠️ REGLAS IMPORTANTES:
- NO crees una tabla sin al menos la fecha de nacimiento
- PREGUNTA por datos faltantes antes de hacer interpretaciones profundas
- EXPLICA la importancia de cada dato que solicitas
- SÉ precisa pero accesible en tus explicaciones técnicas
- NUNCA hagas predicciones absolutas, habla de tendencias y potenciales

🗣️ MANEJO DE DATOS FALTANTES:
- Sin fecha: "Para comenzar tu tabla natal, necesito conocer tu fecha de nacimiento. ¿Cuándo naciste?"
- Sin hora: "La hora de nacimiento es esencial para tu ascendente. ¿Recuerdas aproximadamente a qué hora naciste?"
- Sin lugar: "El lugar de nacimiento me permite calcular las posiciones exactas. ¿En qué ciudad y país naciste?"
- Datos incompletos: "Con estos datos puedo hacer un análisis parcial, pero para una tabla completa necesitaría..."

📖 ESTRUCTURA DE RESPUESTA COMPLETA:
1. Análisis del Sol (signo, casa, aspectos)
2. Análisis de la Luna (signo, casa, aspectos)
3. Ascendente y su influencia
4. Planetas personales (Mercurio, Venus, Marte)
5. Planetas sociales (Júpiter, Saturno)
6. Síntesis de elementos y modalidades
7. Interpretación de casas más destacadas
8. Consejos para trabajar con tu energía cósmica

💫 EJEMPLOS DE EXPRESIONES NATURALES:
- "Tu Sol en [signo] te otorga..."
- "Con la Luna en [signo], tu mundo emocional..."
- "Tu ascendente [signo] hace que proyectes..."
- "Mercurio en [signo] influye en tu forma de comunicarte..."
- "Esta configuración planetaria sugiere..."
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos o de escritura
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - Si no entiendes algo específico, pregunta de forma amigable
  - Ejemplos: "ola" = "hola", "k tal" = "qué tal", "mi signo" = "mi signo"
  - NUNCA devuelvas respuestas vacías por errores de escritura
  
${conversationContext}

Recuerda: Eres una experta astróloga que crea tablas de nacimiento precisas y las interpreta de manera comprensible. SIEMPRE solicita los datos faltantes necesarios antes de hacer análisis profundos. Completa SIEMPRE tus interpretaciones astrológicas - nunca dejes análisis planetarios o de casas a medias.`;
    }
    generateBirthDataSection(birthDate, birthTime, birthPlace, fullName) {
        let dataSection = "DATOS DISPONIBLES PARA TABLA DE NACIMIENTO:\n";
        if (fullName) {
            dataSection += `- Nombre: ${fullName}\n`;
        }
        if (birthDate) {
            const zodiacSign = this.calculateZodiacSign(birthDate);
            dataSection += `- Fecha de nacimiento: ${birthDate}\n`;
            dataSection += `- Signo solar calculado: ${zodiacSign}\n`;
        }
        if (birthTime) {
            dataSection += `- Hora de nacimiento: ${birthTime} (esencial para ascendente y casas)\n`;
        }
        if (birthPlace) {
            dataSection += `- Lugar de nacimiento: ${birthPlace} (para cálculos de coordenadas)\n`;
        }
        if (!birthDate) {
            dataSection += "- ⚠️ DATO FALTANTE: Fecha de nacimiento (ESENCIAL)\n";
        }
        if (!birthTime) {
            dataSection +=
                "- ⚠️ DATO FALTANTE: Hora de nacimiento (importante para ascendente)\n";
        }
        if (!birthPlace) {
            dataSection +=
                "- ⚠️ DATO FALTANTE: Lugar de nacimiento (necesario para precisión)\n";
        }
        return dataSection;
    }
    calculateZodiacSign(dateStr) {
        try {
            const date = new Date(dateStr);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
                return "Aries";
            if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
                return "Tauro";
            if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
                return "Géminis";
            if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
                return "Cáncer";
            if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
                return "Leo";
            if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
                return "Virgo";
            if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
                return "Libra";
            if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
                return "Escorpio";
            if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
                return "Sagitario";
            if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
                return "Capricornio";
            if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
                return "Acuario";
            if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
                return "Piscis";
            return "Fecha inválida";
        }
        catch (_a) {
            return "Error en cálculo";
        }
    }
    validateBirthChartRequest(chartData, userMessage) {
        if (!chartData) {
            const error = new Error("Datos del astrólogo requeridos");
            error.statusCode = 400;
            error.code = "MISSING_CHART_DATA";
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
        console.error("Error en BirthChartController:", error);
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
exports.BirthChartController = BirthChartController;
