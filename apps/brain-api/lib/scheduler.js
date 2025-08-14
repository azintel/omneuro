export async function getAppointments(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
  return [
    {
      id: "apt_001",
      start_time: `${day}T15:00:00Z`,
      location_id: "loc_main",
      service: "IV Drip",
      staff: "Nurse A",
      client_phone: "+15555550101",
      client_name: "Alex Doe",
      client_id: "cli_001"
    },
    {
      id: "apt_002",
      start_time: `${day}T17:30:00Z`,
      location_id: "loc_main",
      service: "B12 Shot",
      staff: "Nurse B",
      client_phone: "+15555550102",
      client_name: "Jordan Smith",
      client_id: "cli_002"
    }
  ];
}