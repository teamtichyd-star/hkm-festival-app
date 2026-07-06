import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const askGemini = async (prompt) => {
  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const generateEventPlan = async ({ festivalName, location, date, expectedCrowd, durationHours, details }) => {
  const prompt = `
You are an expert Hindu festival event planner for HKM (Hare Krishna Movement).

Generate a complete event plan for:
- Festival: ${festivalName}
- Location: ${location}
- Date: ${date}
- Expected Crowd: ${expectedCrowd} people
- Duration: ${durationHours} hours
- Details: ${details || "Standard festival"}

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "departments": [
    { "name": "string", "hod": "", "contact": "", "team": "", "responsibility": "string", "budget": 0, "order": 1 }
  ],
  "tasks": [
    { "title": "string", "phase": "pre", "department": "string", "owner": "", "deadline": "", "status": "Not Started", "order": 1 }
  ],
  "requirements": [
    { "item": "string", "quantity": "string", "unit": "string", "department": "string", "status": "Pending", "cost": 0, "notes": "" }
  ],
  "etiquette": [
    { "rule": "string", "category": "string", "order": 1 }
  ],
  "checkpoints": [
    { "name": "string", "location": "string", "estimate": 0, "order": 1 }
  ],
  "budgetSummary": "string",
  "keyRisks": ["string"],
  "suggestions": ["string"]
}

Rules:
- Departments: 8-15 relevant departments for this specific festival
- Tasks: 15-25 tasks across pre/event/post phases
- Requirements: 10-20 items with realistic quantities for ${expectedCrowd} people
- Etiquette: 8-12 rules appropriate for Vaishnava/ISKCON festivals
- Checkpoints: 3-6 crowd management zones
- Budget: estimate realistically in Indian Rupees
- Make everything specific to ${festivalName} at ${location}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
};

export const getDashboardInsights = async ({ eventName, daysRemaining, tasks, departments, requirements, donations, etiquette }) => {
  const prompt = `
You are an assistant for HKM Festival management app.

Event: ${eventName}
Days Remaining: ${daysRemaining}

Current Status:
- Tasks: ${tasks.done} done, ${tasks.inProgress} in progress, ${tasks.pending} pending out of ${tasks.total}
- Departments: ${departments.withHOD} have HOD, ${departments.missingHOD} missing HOD
- Requirements: ${requirements.arranged} arranged, ${requirements.pending} pending
- Donations: Rs.${donations.received} received vs Rs.${donations.budget} budget
- Etiquette briefings: ${etiquette.briefed}/${etiquette.total} done

Give 3-5 short, specific, actionable suggestions for the event coordinator.
Return ONLY a JSON array of strings. No markdown, no explanation.
Example: ["Suggestion 1", "Suggestion 2"]
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
};

export const generateWhatsAppSummary = async ({ eventName, daysRemaining, tasks, departments, requirements, donations, etiquette }) => {
  const prompt = `
You are writing a WhatsApp status update for HKM (Hare Krishna Movement) festival coordinators.

Event: ${eventName}
Days Remaining: ${daysRemaining}
Tasks: ${tasks.done}/${tasks.total} done (${tasks.pct}%)
Departments: ${departments.total} total, ${departments.missingHOD} missing HOD
Requirements: ${requirements.arranged}/${requirements.total} arranged
Donations: Rs.${donations.received} received, budget Rs.${donations.budget}
Etiquette briefings: ${etiquette.briefed}/${etiquette.total}

Write a short, warm, motivating WhatsApp message (max 150 words) for the festival team.
- Use *bold* for WhatsApp formatting
- Be encouraging and devotional in tone
- Mention urgent items clearly
- End with Hare Krishna!
- Return plain text only, no JSON, no markdown code blocks
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};
