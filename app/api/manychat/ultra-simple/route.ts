import { NextRequest, NextResponse } from 'next/server';

// Ultra-simple endpoint that just returns text
export async function POST(req: NextRequest) {
  console.log('Ultra-simple endpoint called');
  
  return NextResponse.json("Hello from webhook!");
}