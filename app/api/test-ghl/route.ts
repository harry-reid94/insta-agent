import { NextRequest, NextResponse } from 'next/server';
import { ghlService, isGHLConfigured } from '../../lib/integrations/gohighlevel';

export async function GET(req: NextRequest) {
  try {
    // Check if GHL is configured
    if (!isGHLConfigured()) {
      return NextResponse.json({
        error: 'GoHighLevel not configured',
        message: 'Please set all required environment variables: GHL_API_KEY, GHL_LOCATION_ID, GHL_PIPELINE_ID, GHL_INITIAL_STAGE_ID, GHL_CALENDAR_ID'
      }, { status: 400 });
    }

    // Test creating a contact
    console.log('Testing GoHighLevel integration...');
    
    const testResults = {
      configured: true,
      tests: {
        contact: { success: false, error: null, data: null },
        opportunity: { success: false, error: null, data: null },
        calendar: { success: false, error: null, data: null }
      }
    };

    // Test 1: Create a test contact
    try {
      const contact = await ghlService.createContact({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        source: 'API Test',
        tags: ['Test']
      });
      
      testResults.tests.contact.success = true;
      testResults.tests.contact.data = contact;
      console.log('✅ Contact creation successful:', contact.id);

      // Test 2: Create an opportunity for this contact
      if (contact.id) {
        try {
          const opportunity = await ghlService.createOpportunity({
            contactId: contact.id,
            pipelineId: process.env.GHL_PIPELINE_ID!,
            stageId: process.env.GHL_INITIAL_STAGE_ID!,
            name: 'Test Opportunity',
            monetaryValue: 1000,
            status: 'open',
            source: 'API Test'
          });
          
          testResults.tests.opportunity.success = true;
          testResults.tests.opportunity.data = opportunity;
          console.log('✅ Opportunity creation successful:', opportunity.id);
        } catch (error: any) {
          testResults.tests.opportunity.error = error.message;
          console.error('❌ Opportunity creation failed:', error.message);
        }
      }
    } catch (error: any) {
      testResults.tests.contact.error = error.message;
      console.error('❌ Contact creation failed:', error.message);
    }

    // Test 3: Fetch calendar availability
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      
      const slots = await ghlService.getAvailableSlots(
        process.env.GHL_CALENDAR_ID!,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      testResults.tests.calendar.success = true;
      testResults.tests.calendar.data = {
        slotsFound: slots.length,
        firstThreeSlots: slots.slice(0, 3)
      };
      console.log('✅ Calendar availability check successful:', slots.length, 'slots found');
    } catch (error: any) {
      testResults.tests.calendar.error = error.message;
      console.error('❌ Calendar availability check failed:', error.message);
    }

    return NextResponse.json({
      success: true,
      message: 'GoHighLevel integration test completed',
      results: testResults
    });

  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      message: error.message 
    }, { status: 500 });
  }
}