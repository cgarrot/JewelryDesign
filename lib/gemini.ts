import { GoogleGenerativeAI } from '@google/generative-ai';
import { getEnvVar } from './env';

const getGenAI = () => {
  const apiKey = getEnvVar('GEMINI_API_KEY');
  return new GoogleGenerativeAI(apiKey);
};

// Chat model - Gemini 2.5 Flash for chat
export const getChatModel = () => {
  return getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' });
};

// Image generation model - Gemini 2.5 Flash Image
export const getImageModel = () => {
  return getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash-image' });
};

