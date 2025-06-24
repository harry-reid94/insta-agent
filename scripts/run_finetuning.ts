import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables from both .env and .env.local
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log the API key length to verify it's loaded (without exposing the key)
const apiKeyLength = process.env.OPENAI_API_KEY?.length || 0;
console.log(`API Key loaded (length: ${apiKeyLength})`);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function uploadFile(filePath: string): Promise<string> {
  const command = `curl https://api.openai.com/v1/files \
    -H "Authorization: Bearer ${process.env.OPENAI_API_KEY}" \
    -F purpose="fine-tune" \
    -F file="@${filePath}"`;

  const { stdout } = await execAsync(command);
  const response = JSON.parse(stdout);
  return response.id;
}

async function main() {
  const trainingDataPath = join(__dirname, '../data/training_data.jsonl');

  console.log(`Uploading training data from: ${trainingDataPath}`);

  try {
    console.log('Creating file upload...');
    const fileId = await uploadFile(trainingDataPath);

    console.log('File uploaded successfully. File ID:', fileId);

    console.log('Creating fine-tuning job...');
    const fineTune = await openai.fineTuning.jobs.create({
      training_file: fileId,
      model: 'gpt-3.5-turbo',
    });

    console.log('Fine-tuning job created:', fineTune);
    console.log('You can monitor the job status using the job ID:', fineTune.id);
    console.log("Once the job is complete, use the 'fine_tuned_model' ID in your application.");

  } catch (error) {
    console.error('An error occurred during the fine-tuning process:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

main(); 