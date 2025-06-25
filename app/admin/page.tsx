import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';

export const runtime = 'nodejs';
export const revalidate = 0; // force dynamic rendering

async function getConversations() {
  const dir = path.join('/tmp', 'conversations');
  try {
    const filenames = await fs.readdir(dir);
    return filenames.filter(name => name.endsWith('.json')).sort().reverse();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // The directory doesn't exist, which is an expected state before any
      // conversations have been saved. We can safely return an empty array.
      return [];
    }
    // For any other type of error, we should log it to the console.
    console.error('Could not read conversations directory:', error);
    return [];
  }
}

export default async function AdminPage() {
  const conversations = await getConversations();

  return (
    <div className="container mx-auto p-4 text-black">
      <h1 className="text-2xl font-bold mb-4">Conversation History</h1>
      {conversations.length > 0 ? (
        <ul>
          {conversations.map((convo) => (
            <li key={convo} className="mb-2">
              <Link href={`/admin/conversations/${convo.replace('.json', '')}`} className="text-blue-500 hover:underline">
                {new Date(parseInt(convo.split('-')[0])).toLocaleString()} - {convo}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No conversations found.</p>
      )}
    </div>
  );
} 