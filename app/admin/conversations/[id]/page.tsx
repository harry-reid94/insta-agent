import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const revalidate = 0; // force dynamic rendering

async function getConversation(id: string) {
  const dir = path.join('/tmp', 'conversations');
  const filepath = path.join(dir, `${id}.json`);
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Could not read conversation file ${filepath}:`, error);
    return null;
  }
}

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const conversation = await getConversation(params.id);

  if (!conversation) {
    return (
      <div className="container mx-auto p-4 text-black">
        <h1 className="text-2xl font-bold mb-4">Conversation Not Found</h1>
        <p>The requested conversation could not be found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 text-black">
      <h1 className="text-2xl font-bold mb-4">Conversation Details</h1>
      <h2 className="text-xl font-semibold mb-2">Initial State</h2>
      <pre className="bg-gray-100 p-4 rounded-md mb-4">{JSON.stringify(conversation.initialState, null, 2)}</pre>
      <h2 className="text-xl font-semibold mb-2">Result</h2>
      <pre className="bg-gray-100 p-4 rounded-md">{JSON.stringify(conversation.result, null, 2)}</pre>
    </div>
  );
} 