export const availabilityService = {
  getAvailableSlots: async (): Promise<Date[]> => {
    const slots: Date[] = [];
    const now = new Date();
    let current = new Date(now.getTime());
    current.setHours(current.getHours() + 2); // Start 2 hours from now to be safe
    current.setMinutes(0);
    current.setSeconds(0);
    current.setMilliseconds(0);

    while (slots.length < 3) {
      current.setHours(current.getHours() + 1);
      const hour = current.getHours();
      // Let's assume business hours are 9am to 5pm (17:00)
      if (hour >= 9 && hour <= 17) {
        // Only add slots on the hour
        if (current.getMinutes() === 0) {
            slots.push(new Date(current.getTime()));
        }
      }

      // If it's past 5pm, move to the next day
      if (hour > 17) {
        current.setDate(current.getDate() + 1);
        current.setHours(9);
        current.setMinutes(0);
      }
    }
    return slots;
  },
}; 