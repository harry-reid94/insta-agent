import axios from 'axios';

// Get configuration from environment variables
const API_KEY = process.env.GHL_API_KEY || '';
const LOCATION_ID = process.env.GHL_LOCATION_ID || '';
const PIPELINE_ID = process.env.GHL_PIPELINE_ID || '';
const INITIAL_STAGE_ID = process.env.GHL_INITIAL_STAGE_ID || '';
const CALENDAR_ID = process.env.GHL_CALENDAR_ID || '';

export interface GHLContact {
  id?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface GHLOpportunity {
  id?: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  name: string;
  monetaryValue?: number;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  source?: string;
  customFields?: Record<string, any>;
}

export interface GHLCalendarSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
  calendarId: string;
}

export interface GHLBooking {
  id?: string;
  contactId: string;
  calendarId: string;
  appointmentDate: string;
  appointmentTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'no-show';
}

export class GoHighLevelService {
  private apiKey: string;
  private baseUrl = 'https://rest.gohighlevel.com/v1';
  private locationId: string;

  constructor(
    apiKey: string = API_KEY,
    locationId: string = LOCATION_ID
  ) {
    this.apiKey = apiKey;
    this.locationId = locationId;
    
    // Warn if credentials are missing
    if (!this.apiKey || !this.locationId) {
      console.warn('⚠️  GoHighLevel credentials not configured. Please set GHL_API_KEY and GHL_LOCATION_ID in your .env.local file.');
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Create a new contact
  async createContact(contact: GHLContact): Promise<GHLContact> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/contacts/`,
        {
          ...contact,
          locationId: this.locationId
        },
        { headers: this.getHeaders() }
      );

      return response.data.contact;
    } catch (error) {
      console.error('Error creating GHL contact:', error);
      throw error;
    }
  }

  // Update an existing contact
  async updateContact(contactId: string, updates: Partial<GHLContact>): Promise<GHLContact> {
    try {
      const response = await axios.put(
        `${this.baseUrl}/contacts/${contactId}`,
        updates,
        { headers: this.getHeaders() }
      );

      return response.data.contact;
    } catch (error) {
      console.error('Error updating GHL contact:', error);
      throw error;
    }
  }

  // Get contact by ID
  async getContact(contactId: string): Promise<GHLContact> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/contacts/${contactId}`,
        { headers: this.getHeaders() }
      );

      return response.data.contact;
    } catch (error) {
      console.error('Error fetching GHL contact:', error);
      throw error;
    }
  }

  // Create a new opportunity
  async createOpportunity(opportunity: GHLOpportunity): Promise<GHLOpportunity> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/opportunities/`,
        {
          ...opportunity,
          locationId: this.locationId
        },
        { headers: this.getHeaders() }
      );

      return response.data.opportunity;
    } catch (error) {
      console.error('Error creating GHL opportunity:', error);
      throw error;
    }
  }

  // Update opportunity status
  async updateOpportunity(opportunityId: string, updates: Partial<GHLOpportunity>): Promise<GHLOpportunity> {
    try {
      const response = await axios.put(
        `${this.baseUrl}/opportunities/${opportunityId}`,
        updates,
        { headers: this.getHeaders() }
      );

      return response.data.opportunity;
    } catch (error) {
      console.error('Error updating GHL opportunity:', error);
      throw error;
    }
  }

  // Get available calendar slots
  async getAvailableSlots(calendarId: string, startDate: string, endDate: string): Promise<GHLCalendarSlot[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/calendars/${calendarId}/free-slots`,
        {
          params: {
            startDate,
            endDate
          },
          headers: this.getHeaders()
        }
      );

      return response.data.slots || [];
    } catch (error) {
      console.error('Error fetching available slots:', error);
      throw error;
    }
  }

  // Create a booking
  async createBooking(booking: GHLBooking): Promise<GHLBooking> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/appointments/`,
        {
          ...booking,
          locationId: this.locationId
        },
        { headers: this.getHeaders() }
      );

      return response.data.appointment;
    } catch (error) {
      console.error('Error creating GHL booking:', error);
      throw error;
    }
  }

  // Create appointment from selected time string
  async createAppointmentFromTimeString(
    contactId: string,
    calendarId: string,
    selectedTime: string,
    email: string
  ): Promise<GHLBooking | null> {
    try {
      // Parse the selected time (e.g., "Tuesday 10am", "tomorrow at 2pm")
      const appointmentDate = this.parseTimeString(selectedTime);
      if (!appointmentDate) {
        console.error('Could not parse time string:', selectedTime);
        return null;
      }

      const booking = await this.createBooking({
        contactId,
        calendarId,
        appointmentDate: appointmentDate.toISOString().split('T')[0],
        appointmentTime: appointmentDate.toISOString().split('T')[1].substring(0, 5),
        status: 'scheduled'
      });

      // Send confirmation email would happen here via GHL automation
      console.log(`✅ Appointment booked for ${email} on ${appointmentDate.toLocaleString()}`);
      
      return booking;
    } catch (error) {
      console.error('Error creating appointment:', error);
      return null;
    }
  }

  // Parse time strings like "Tuesday 10am", "tomorrow at 2pm" into Date objects
  private parseTimeString(timeString: string): Date | null {
    const now = new Date();
    const lowerTime = timeString.toLowerCase();
    
    // Extract time (10am, 2pm, etc.)
    const timeMatch = lowerTime.match(/(\d{1,2})(:\d{2})?(\s)?(am|pm)/i);
    if (!timeMatch) return null;
    
    let hour = parseInt(timeMatch[1]);
    const isPM = timeMatch[4].toLowerCase() === 'pm';
    
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    const result = new Date();
    result.setHours(hour, 0, 0, 0);
    
    // Handle day references
    if (lowerTime.includes('tomorrow')) {
      result.setDate(result.getDate() + 1);
    } else if (lowerTime.includes('monday')) {
      this.setToNextWeekday(result, 1);
    } else if (lowerTime.includes('tuesday')) {
      this.setToNextWeekday(result, 2);
    } else if (lowerTime.includes('wednesday')) {
      this.setToNextWeekday(result, 3);
    } else if (lowerTime.includes('thursday')) {
      this.setToNextWeekday(result, 4);
    } else if (lowerTime.includes('friday')) {
      this.setToNextWeekday(result, 5);
    }
    
    return result;
  }

  private setToNextWeekday(date: Date, targetDay: number): void {
    const currentDay = date.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
    date.setDate(date.getDate() + daysUntilTarget);
  }

  // Generate booking link for a calendar
  async generateBookingLink(calendarId: string, contactId?: string): Promise<string> {
    try {
      const baseBookingUrl = `https://app.gohighlevel.com/widget/booking/${calendarId}`;
      
      if (contactId) {
        return `${baseBookingUrl}?contact_id=${contactId}`;
      }
      
      return baseBookingUrl;
    } catch (error) {
      console.error('Error generating booking link:', error);
      throw error;
    }
  }

  // Add tags to contact
  async addTagsToContact(contactId: string, tags: string[]): Promise<boolean> {
    try {
      await axios.post(
        `${this.baseUrl}/contacts/${contactId}/tags`,
        { tags },
        { headers: this.getHeaders() }
      );

      return true;
    } catch (error) {
      console.error('Error adding tags to contact:', error);
      throw error;
    }
  }

  // Create a complete qualified lead workflow
  async createQualifiedLead(
    firstName: string,
    lastName: string,
    instagramUsername: string,
    portfolioSize: number,
    painPoints: string,
    bmbUnderstanding: string,
    source: string = 'Instagram DM'
  ): Promise<{ contact: GHLContact; opportunity: GHLOpportunity; bookingLink: string }> {
    try {
      // Create contact
      const contact = await this.createContact({
        firstName,
        lastName: lastName || '',
        source,
        tags: ['Instagram Lead', 'Qualified', 'BMB Prospect'],
        customFields: {
          instagramUsername,
          portfolioSize: portfolioSize.toString(),
          painPoints,
          bmbUnderstanding,
          qualificationDate: new Date().toISOString()
        }
      });

      // Create opportunity
      const opportunity = await this.createOpportunity({
        contactId: contact.id!,
        pipelineId: PIPELINE_ID,
        stageId: INITIAL_STAGE_ID,
        name: `${firstName} - BMB Consultation`,
        monetaryValue: this.estimateOpportunityValue(portfolioSize),
        status: 'open',
        source,
        customFields: {
          portfolioSize: portfolioSize.toString(),
          painPoints,
          leadSource: 'Instagram DM Qualification'
        }
      });

      // Generate booking link
      const bookingLink = await this.generateBookingLink(
        CALENDAR_ID,
        contact.id
      );

      return { contact, opportunity, bookingLink };
    } catch (error) {
      console.error('Error creating qualified lead:', error);
      throw error;
    }
  }

  // Create a complete qualified lead workflow with appointment
  async createQualifiedLeadWithAppointment(
    firstName: string,
    lastName: string,
    email: string,
    instagramUsername: string,
    portfolioSize: number,
    painPoints: string,
    bmbUnderstanding: string,
    selectedTime: string,
    source: string = 'Instagram DM'
  ): Promise<{ 
    contact: GHLContact; 
    opportunity: GHLOpportunity; 
    bookingLink: string;
    appointment: GHLBooking | null;
  }> {
    try {
      // First create the qualified lead
      const leadResult = await this.createQualifiedLead(
        firstName,
        lastName,
        instagramUsername,
        portfolioSize,
        painPoints,
        bmbUnderstanding,
        source
      );

      // Update contact with email
      if (email && leadResult.contact.id) {
        await this.updateContact(leadResult.contact.id, { email });
      }

      // Create the appointment
      let appointment = null;
      if (selectedTime && leadResult.contact.id) {
        appointment = await this.createAppointmentFromTimeString(
          leadResult.contact.id,
          CALENDAR_ID,
          selectedTime,
          email
        );
      }

      return { ...leadResult, appointment };
    } catch (error) {
      console.error('Error creating qualified lead with appointment:', error);
      throw error;
    }
  }

  // Estimate opportunity value based on portfolio size
  private estimateOpportunityValue(portfolioSize: number): number {
    // Estimate based on typical management fees (1-2% annually)
    if (portfolioSize >= 1000000) return 15000; // $1M+ portfolio
    if (portfolioSize >= 500000) return 8000;   // $500K+ portfolio
    if (portfolioSize >= 250000) return 4000;   // $250K+ portfolio
    if (portfolioSize >= 100000) return 2000;   // $100K+ portfolio
    return 1000; // Default for $50K+ portfolio
  }
}

// Initialize with environment variables
export const ghlService = new GoHighLevelService();

// Helper function to check if GHL is properly configured
export function isGHLConfigured(): boolean {
  return !!(API_KEY && LOCATION_ID && PIPELINE_ID && INITIAL_STAGE_ID && CALENDAR_ID);
} 