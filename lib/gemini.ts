import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { getEnvVar } from './env';

const getGenAI = () => {
  const apiKey = getEnvVar('GEMINI_API_KEY');
  return new GoogleGenerativeAI(apiKey);
};

// Default generation config
export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  temperature: 1.0,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

// Parse LLM parameters from JSON and merge with defaults
export const parseGenerationConfig = (llmParameters: any): GenerationConfig | undefined => {
  if (!llmParameters || typeof llmParameters !== 'object') {
    return undefined;
  }

  const config: Partial<GenerationConfig> = {};
  
  if (typeof llmParameters.temperature === 'number') {
    config.temperature = llmParameters.temperature;
  }
  if (typeof llmParameters.topP === 'number') {
    config.topP = llmParameters.topP;
  }
  if (typeof llmParameters.topK === 'number') {
    config.topK = llmParameters.topK;
  }
  if (typeof llmParameters.maxOutputTokens === 'number') {
    config.maxOutputTokens = llmParameters.maxOutputTokens;
  }

  return Object.keys(config).length > 0 ? config : undefined;
};

// Chat model - Gemini 2.5 Flash for chat
export const getChatModel = (generationConfig?: GenerationConfig) => {
  return getGenAI().getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: generationConfig,
  });
};

// Image generation model - Gemini 2.5 Flash Image
export const getImageModel = (generationConfig?: GenerationConfig) => {
  return getGenAI().getGenerativeModel({ 
    model: 'gemini-2.5-flash-image',
    generationConfig: generationConfig,
  });
};

