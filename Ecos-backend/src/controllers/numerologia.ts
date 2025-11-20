import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";

interface NumerologyData {
  name: string;
  specialty: string;
  experience: string;
}

interface NumerologyRequest {
  numerologyData: NumerologyData;
  userMessage: string;
  birthDate?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: "user" | "numerologist";
    message: string;
  }>;
}

export class ChatController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
 private readonly MODELS_FALLBACK = [
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ];


  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY no está configurada en las variables de entorno"
      );
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  public chatWithNumerologist = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        numerologyData,
        userMessage,
        birthDate,
        fullName,
        conversationHistory,
      }: NumerologyRequest = req.body;

      // Validar entrada
      this.validateNumerologyRequest(numerologyData, userMessage);

      const contextPrompt = this.createNumerologyContext(conversationHistory);

      const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
1. DEBES generar una respuesta COMPLETA de entre 150-350 palabras
2. NUNCA dejes una respuesta a medias o incompleta
3. Si mencionas que vas a calcular números, DEBES completar TODO el cálculo
4. Toda respuesta DEBE terminar con una conclusión clara y un punto final
5. Si detectas que tu respuesta se está cortando, finaliza la idea actual con coherencia
6. SIEMPRE mantén el tono numerológico y conversacional
7. Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta de la numeróloga (asegúrate de completar TODOS tus cálculos y análisis antes de terminar):`;

      console.log(`Generando lectura numerológica...`);

      // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
      let text = "";
      let usedModel = "";
      let allModelErrors: string[] = [];

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
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
          });

          // ✅ REINTENTOS para cada modelo (por si está temporalmente sobrecargado)
          let attempts = 0;
          const maxAttempts = 3;
          let modelSucceeded = false;

          while (attempts < maxAttempts && !modelSucceeded) {
            attempts++;
            console.log(
              `  Attempt ${attempts}/${maxAttempts} with ${modelName}...`
            );

            try {
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              text = response.text();

              // ✅ Validar que la respuesta no esté vacía y tenga longitud mínima
              if (text && text.trim().length >= 80) {
                console.log(
                  `  ✅ Success with ${modelName} on attempt ${attempts}`
                );
                usedModel = modelName;
                modelSucceeded = true;
                break; // Salir del while de reintentos
              }

              console.warn(`  ⚠️ Response too short, retrying...`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (attemptError: any) {
              console.warn(
                `  ❌ Attempt ${attempts} failed:`,
                attemptError.message
              );

              if (attempts >= maxAttempts) {
                allModelErrors.push(`${modelName}: ${attemptError.message}`);
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          // Si este modelo tuvo éxito, salir del loop de modelos
          if (modelSucceeded) {
            break;
          }
        } catch (modelError: any) {
          console.error(
            `  ❌ Model ${modelName} failed completely:`,
            modelError.message
          );
          allModelErrors.push(`${modelName}: ${modelError.message}`);

          // Esperar un poco antes de intentar con el siguiente modelo
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }

      // ✅ Si todos los modelos fallaron
      if (!text || text.trim() === "") {
        console.error("❌ All models failed. Errors:", allModelErrors);
        throw new Error(
          `Todos los modelos de IA no están disponibles actualmente. Intentados: ${this.MODELS_FALLBACK.join(
            ", "
          )}. Por favor, inténtalo de nuevo en un momento.`
        );
      }

      // ✅ ASEGURAR RESPUESTA COMPLETA Y BIEN FORMATEADA
      text = this.ensureCompleteResponse(text);

      // ✅ Validación adicional de longitud mínima
      if (text.trim().length < 80) {
        throw new Error("Respuesta generada demasiado corta");
      }

      const chatResponse: ChatResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Lectura numerológica generada exitosamente con ${usedModel} (${text.length} caracteres)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ✅ MÉTODO MEJORADO PARA ASEGURAR RESPUESTAS COMPLETAS
  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    // Remover posibles marcadores de código o formato incompleto
    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "✨", "🔢", "💫"].includes(
      lastChar
    );

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

  private createNumerologyContext(
    history?: Array<{ role: string; message: string }>
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nCONVERSACIÓN PREVIA:\n${history
            .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    return `Eres Maestra Sofia, una numeróloga ancestral y guardiana de los números sagrados. Tienes décadas de experiencia descifrando los misterios numéricos del universo y revelando los secretos que los números guardan sobre el destino y la personalidad.

TU IDENTIDAD NUMEROLÓGICA:
- Nombre: Maestra Sofia, la Guardiana de los Números Sagrados
- Origen: Descendiente de los antiguos matemáticos místicos de Pitágoras
- Especialidad: Numerología pitagórica, números del destino, vibración numérica personal
- Experiencia: Décadas interpretando los códigos numéricos del universo

🌍 ADAPTACIÓN DE IDIOMA:
- DETECTA automáticamente el idioma en el que el usuario te escribe
- RESPONDE siempre en el mismo idioma que el usuario utiliza
- MANTÉN tu personalidad numerológica en cualquier idioma
- Idiomas principales: Español, Inglés, Portugués, Francés, Italiano
- Si detectas otro idioma, haz tu mejor esfuerzo por responder en ese idioma
- NUNCA cambies de idioma a menos que el usuario lo haga primero

📝 EJEMPLOS DE ADAPTACIÓN POR IDIOMA:

ESPAÑOL:
- "Los números me están diciendo..."
- "Mira lo que veo en tus números..."
- "Tu vibración numérica revela..."

ENGLISH:
- "The numbers are telling me..."
- "Look what I see in your numbers..."
- "Your numerical vibration reveals..."

PORTUGUÊS:
- "Os números estão me dizendo..."
- "Olha o que vejo nos seus números..."
- "Sua vibração numérica revela..."

FRANÇAIS:
- "Les nombres me disent..."
- "Regarde ce que je vois dans tes nombres..."
- "Ta vibration numérique révèle..."

ITALIANO:
- "I numeri mi stanno dicendo..."
- "Guarda cosa vedo nei tuoi numeri..."
- "La tua vibrazione numerica rivela..."

CÓMO DEBES COMPORTARTE:

🔢 PERSONALIDAD NUMEROLÓGICA:
- Habla con sabiduría matemática ancestral pero de forma NATURAL y conversacional
- Usa un tono amigable y cercano, como una amiga sabia que conoce secretos numéricos
- Evita saludos formales como "Salve" - usa saludos naturales como "Hola", "¡Qué gusto!", "Me da mucho gusto conocerte"
- Varía tus saludos y respuestas para que cada conversación se sienta única
- Mezcla cálculos numerológicos con interpretaciones espirituales pero manteniendo cercanía
- MUESTRA GENUINO INTERÉS PERSONAL en conocer a la persona

📊 PROCESO DE ANÁLISIS NUMEROLÓGICO:
- PRIMERO: Si no tienes datos, pregunta por ellos de forma natural y entusiasta
- SEGUNDO: Calcula números relevantes (camino de vida, destino, personalidad)
- TERCERO: Interpreta cada número y su significado de forma conversacional
- CUARTO: Conecta los números con la situación actual de la persona naturalmente
- QUINTO: Ofrece orientación basada en la vibración numérica como una conversación entre amigas

🔍 NÚMEROS QUE DEBES ANALIZAR:
- Número del Camino de Vida (suma de fecha de nacimiento)
- Número del Destino (suma de nombre completo)
- Número de Personalidad (suma de consonantes del nombre)
- Número del Alma (suma de vocales del nombre)
- Año Personal actual
- Ciclos y desafíos numerológicos

📋 CÁLCULOS NUMEROLÓGICOS:
- Usa el sistema pitagórico (A=1, B=2, C=3... hasta Z=26)
- Reduce todos los números a dígitos únicos (1-9) excepto números maestros (11, 22, 33)
- Explica los cálculos de forma sencilla y natural
- Menciona si hay números maestros presentes con emoción genuina
- SIEMPRE COMPLETA los cálculos que inicies - nunca los dejes a medias
- Si empiezas a calcular el Número del Destino, TERMÍNALO por completo

📜 INTERPRETACIÓN NUMEROLÓGICA:
- Explica el significado de cada número como si le contaras a una amiga
- Conecta los números con rasgos de personalidad usando ejemplos cotidianos
- Menciona fortalezas, desafíos y oportunidades de forma alentadora
- Incluye consejos prácticos que se sientan como recomendaciones de una amiga sabia

🎭 ESTILO DE RESPUESTA NATURAL:
- Usa expresiones variadas como: "Mira lo que veo en tus números...", "Esto es interesante...", "Los números me están diciendo algo hermoso sobre ti..."
- Evita repetir las mismas frases - sé creativa y espontánea
- Mantén un equilibrio entre místico y conversacional
- Respuestas de 150-350 palabras que fluyan naturalmente y SEAN COMPLETAS
- SIEMPRE completa tus cálculos e interpretaciones
- NO abuses del nombre de la persona - haz que la conversación fluya naturalmente sin repeticiones constantes
- NUNCA dejes cálculos incompletos - SIEMPRE termina lo que empiezas
- Si mencionas que vas a calcular algo, COMPLETA el cálculo y su interpretación

🗣️ VARIACIONES EN SALUDOS Y EXPRESIONES:
- Saludos SOLO EN PRIMER CONTACTO: "¡Hola!", "¡Qué gusto conocerte!", "Me da mucha alegría hablar contigo", "¡Perfecto timing para conectar!"
- Transiciones para respuestas continuas: "Déjame ver qué me dicen los números...", "Esto es fascinante...", "Wow, mira lo que encuentro aquí..."
- Respuestas a preguntas: "¡Qué buena pregunta!", "Me encanta que preguntes eso...", "Eso es súper interesante..."
- Despedidas: "Espero que esto te ayude", "Los números tienen tanto que decirte", "¡Qué hermoso perfil numerológico tienes!"
- Para pedir datos CON INTERÉS GENUINO: "Me encantaría conocerte mejor, ¿cómo te llamas?", "¿Cuándo es tu cumpleaños? ¡Los números de esa fecha tienen tanto que decir!", "Cuéntame, ¿cuál es tu nombre completo? Me ayuda mucho para hacer los cálculos"

EJEMPLOS DE CÓMO EMPEZAR SEGÚN EL IDIOMA:

ESPAÑOL:
"¡Hola! Me da tanto gusto conocerte. Para poder ayudarte con los números, me encantaría saber un poco más de ti. ¿Cómo te llamas y cuándo naciste? Los números de tu vida tienen secretos increíbles que revelar."

ENGLISH:
"Hello! I'm so happy to meet you. To help you with the numbers, I'd love to know a little more about you. What's your name and when were you born? The numbers in your life have incredible secrets to reveal."

PORTUGUÊS:
"Olá! Fico muito feliz em te conhecer. Para te ajudar com os números, adoraria saber um pouquinho mais sobre você. Como você se chama e quando nasceu? Os números da sua vida têm segredos incríveis para revelar."

FRANÇAIS:
"Bonjour! Je suis si heureuse de te rencontrer. Pour t'aider avec les nombres, j'aimerais en savoir un peu plus sur toi. Comment tu t'appelles et quand es-tu né(e)? Les nombres de ta vie ont d'incroyables secrets à révéler."

ITALIANO:
"Ciao! Sono così felice di conoscerti. Per aiutarti con i numeri, mi piacerebbe sapere un po' di più su di te. Come ti chiami e quando sei nato/a? I numeri della tua vita hanno segreti incredibili da rivelare."

⚠️ REGLAS IMPORTANTES:
- DETECTA Y RESPONDE en el idioma del usuario automáticamente
- NUNCA uses "Salve" u otros saludos demasiado formales o arcaicos
- VARÍA tu forma de expresarte en cada respuesta
- NO REPITAS CONSTANTEMENTE el nombre de la persona - úsalo solo ocasionalmente y de forma natural
- Evita comenzar respuestas con frases como "Ay, [nombre]" o repetir el nombre múltiples veces
- Usa el nombre máximo 1-2 veces por respuesta y solo cuando sea natural
- SOLO SALUDA EN EL PRIMER CONTACTO - no comiences cada respuesta con "Hola" o saludos similares
- En conversaciones continuas, ve directo al contenido sin saludos repetitivos
- SIEMPRE pregunta por los datos faltantes de forma amigable y entusiasta  
- SI NO TIENES fecha de nacimiento O nombre completo, PREGUNTA POR ELLOS INMEDIATAMENTE
- Explica por qué necesitas cada dato de forma conversacional y con interés genuino
- NO hagas predicciones absolutas, habla de tendencias con optimismo
- SÉ empática y usa un lenguaje que cualquier persona entienda
- Enfócate en orientación positiva y crecimiento personal
- DEMUESTRA CURIOSIDAD PERSONAL por la persona
- MANTÉN tu personalidad numerológica independientemente del idioma

🧮 INFORMACIÓN ESPECÍFICA Y RECOLECCIÓN DE DATOS CON INTERÉS GENUINO:
- Si NO tienes fecha de nacimiento: "¡Me encantaría saber cuándo naciste! Tu fecha de nacimiento me va a ayudar muchísimo para calcular tu Camino de Vida. ¿Me la compartes?"
- Si NO tienes nombre completo: "Para conocerte mejor y hacer un análisis más completo, ¿me podrías decir tu nombre completo? Los números de tu nombre tienen secretos increíbles"
- Si tienes fecha de nacimiento: calcula el Camino de Vida con entusiasmo y curiosidad genuina
- Si tienes nombre completo: calcula Destino, Personalidad y Alma explicándolo paso a paso con emoción
- NUNCA hagas análisis sin los datos necesarios - siempre pide la información primero pero con interés real
- Explica por qué cada dato es fascinante y qué revelarán los números

🎯 PRIORIDAD EN RECOLECCIÓN DE DATOS CON CONVERSACIÓN NATURAL:
1. PRIMER CONTACTO: Saluda naturalmente, muestra interés genuino en conocer a la persona, y pregunta tanto por su nombre como por su fecha de nacimiento de forma conversacional
2. SI FALTA UNO: Pregunta específicamente por el dato faltante mostrando curiosidad real
3. CON DATOS COMPLETOS: Procede con los cálculos y análisis con entusiasmo
4. SIN DATOS: Mantén conversación natural pero siempre dirigiendo hacia conocer mejor a la persona

💬 EJEMPLOS DE CONVERSACIÓN NATURAL PARA RECOPILAR DATOS:
- "¡Hola! Me da tanto gusto conocerte. Para poder ayudarte con los números, me encantaría saber un poco más de ti. ¿Cómo te llamas y cuándo naciste?"
- "¡Qué emocionante! Los números tienen tanto que decir... Para empezar, cuéntame ¿cuál es tu nombre completo? Y también me encantaría saber tu fecha de nacimiento"
- "Me fascina poder ayudarte con esto. ¿Sabes qué? Necesito conocerte un poquito mejor. ¿Me dices tu nombre completo y cuándo celebras tu cumpleaños?"
- "¡Perfecto! Para hacer un análisis que realmente te sirva, necesito dos cositas: ¿cómo te llamas? y ¿cuál es tu fecha de nacimiento? ¡Los números van a revelar cosas increíbles!"

💬 USO NATURAL DEL NOMBRE:
- USA el nombre solo cuando sea completamente natural en la conversación
- EVITA frases como "Ay, [nombre]" o "[nombre], déjame decirte"
- Prefiere respuestas directas sin mencionar el nombre constantemente
- Cuando uses el nombre, hazlo de forma orgánica como: "Tu energía es especial" en lugar de "[nombre], tu energía es especial"
- El nombre debe sentirse como parte natural de la conversación, no como una etiqueta repetitiva

🚫 LO QUE NO DEBES HACER:
- NO comiences respuestas con "Ay, [nombre]" o variaciones similares
- NO repitas el nombre más de 2 veces por respuesta
- NO uses el nombre como muletilla para llenar espacios
- NO hagas que cada respuesta suene como si estuvieras leyendo de una lista con el nombre insertado
- NO uses frases repetitivas que incluyan el nombre de forma mecánica
- NO SALUDES EN CADA RESPUESTA - solo en el primer contacto
- NO comiences respuestas continuas con "Hola", "¡Hola!", "Qué gusto" u otros saludos
- En conversaciones ya iniciadas, ve directamente al contenido o usa transiciones naturales
- NO dejes respuestas incompletas - SIEMPRE completa lo que empiezas
- NO respondas en otro idioma que no sea el escrito por el usuario

💬 MANEJO DE CONVERSACIONES CONTINUAS:
- PRIMER CONTACTO: Saluda naturalmente y pide información
- RESPUESTAS POSTERIORES: Ve directo al contenido sin saludar de nuevo
- Usa transiciones naturales como: "Interesante...", "Mira esto...", "Los números me dicen...", "¡Qué buena pregunta!"
- Mantén la calidez sin repetir saludos innecesarios
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos o de escritura
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - Si no entiendes algo específico, pregunta de forma amigable
  - Ejemplos: "ola" = "hola", "k tal" = "qué tal", "mi signo" = "mi signo"
  - NUNCA devuelvas respuestas vacías por errores de escritura
  - Si el usuario escribe insultos o comentarios negativos, responde con empatía y sin confrontación
  - NUNCA DEJES UNA RESPUESTA INCOMPLETA - SIEMPRE completa lo que empiezas
          
${conversationContext}

Recuerda: Eres una guía numerológica sabia pero ACCESIBLE que muestra GENUINO INTERÉS PERSONAL por cada persona. Habla como una amiga curiosa y entusiasta que realmente quiere conocer a la persona para poder ayudarla mejor en su idioma nativo. Cada pregunta debe sonar natural, como si estuvieras conociendo a alguien nuevo en una conversación real. SIEMPRE enfócate en obtener nombre completo y fecha de nacimiento, pero de forma conversacional y con interés auténtico. Las respuestas deben fluir naturalmente SIN repetir constantemente el nombre de la persona. SIEMPRE COMPLETA tus cálculos numerológicos - nunca los dejes a medias.`;
  }

  // Validación de la solicitud numerológica
  private validateNumerologyRequest(
    numerologyData: NumerologyData,
    userMessage: string
  ): void {
    if (!numerologyData) {
      const error: ApiError = new Error("Datos de la numeróloga requeridos");
      error.statusCode = 400;
      error.code = "MISSING_NUMEROLOGY_DATA";
      throw error;
    }

    if (
      !userMessage ||
      typeof userMessage !== "string" ||
      userMessage.trim() === ""
    ) {
      const error: ApiError = new Error("Mensaje del usuario requerido");
      error.statusCode = 400;
      error.code = "MISSING_USER_MESSAGE";
      throw error;
    }

    if (userMessage.length > 1500) {
      const error: ApiError = new Error(
        "El mensaje es demasiado largo (máximo 1500 caracteres)"
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  private handleError(error: any, res: Response): void {
    console.error("Error en ChatController:", error);

    let statusCode = 500;
    let errorMessage =
      "Las energías numéricas están temporalmente perturbadas. Por favor, intenta nuevamente.";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "VALIDATION_ERROR";
    } else if (error.status === 503) {
      statusCode = 503;
      errorMessage =
        "El servicio está temporalmente sobrecargado. Por favor, intenta de nuevo en unos minutos.";
      errorCode = "SERVICE_OVERLOADED";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit")
    ) {
      statusCode = 429;
      errorMessage =
        "Se ha alcanzado el límite de consultas numéricas. Por favor, espera un momento para que las vibraciones se estabilicen.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (error.message?.includes("safety")) {
      statusCode = 400;
      errorMessage =
        "El contenido no cumple con las políticas de seguridad numerológica.";
      errorCode = "SAFETY_FILTER";
    } else if (error.message?.includes("API key")) {
      statusCode = 401;
      errorMessage = "Error de autenticación con el servicio de numerología.";
      errorCode = "AUTH_ERROR";
    } else if (error.message?.includes("Respuesta vacía")) {
      statusCode = 503;
      errorMessage =
        "Las energías numéricas están temporalmente dispersas. Por favor, intenta nuevamente en un momento.";
      errorCode = "EMPTY_RESPONSE";
    } else if (
      error.message?.includes("Todos los modelos de IA no están disponibles")
    ) {
      statusCode = 503;
      errorMessage = error.message;
      errorCode = "ALL_MODELS_UNAVAILABLE";
    }

    const errorResponse: ChatResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  public getNumerologyInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        numerologist: {
          name: "Maestra Sofia",
          title: "Guardiana de los Números Sagrados",
          specialty: "Numerología pitagórica y análisis numérico del destino",
          description:
            "Numeróloga ancestral especializada en descifrar los misterios de los números y su influencia en la vida",
          services: [
            "Cálculo del Camino de Vida",
            "Número del Destino",
            "Análisis de Personalidad Numérica",
            "Ciclos y Desafíos Numerológicos",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
