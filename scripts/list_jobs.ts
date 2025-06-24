import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables from both .env and .env.local
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  try {
    console.log('Fetching fine-tuning jobs...\n');
    
    const jobs = await openai.fineTuning.jobs.list();
    
    for (const job of jobs.data) {
      console.log(`Job ID: ${job.id}`);
      console.log(`Status: ${job.status}`);
      console.log(`Model: ${job.model}`);
      console.log(`Created at: ${new Date(job.created_at * 1000).toLocaleString()}`);
      console.log(`Training file: ${job.training_file}`);
      
      if (job.fine_tuned_model) {
        console.log(`Fine-tuned model: ${job.fine_tuned_model}`);
      }
      
      if (job.finished_at) {
        console.log(`Finished at: ${new Date(job.finished_at * 1000).toLocaleString()}`);
      }
      
      if (job.error && Object.keys(job.error).length > 0) {
        console.log('Error:', job.error);
      }
      
      console.log('-------------------\n');
    }

  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main(); 