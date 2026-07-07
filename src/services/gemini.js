const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

const groq = async (prompt, jsonMode = false) => {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + GROQ_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.7,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
};

export const generateEventPlan = async ({ festivalName, location, date, expectedCrowd, durationHours, details }) => {
  const prompt = `You are an expert Hindu festival event planner for HKM (Hare Krishna Movement).

Generate a complete event plan for:
- Festival: ${festivalName}
- Location: ${location}
- Date: ${date}
- Expected Crowd: ${expectedCrowd} people
- Duration: ${durationHours} hours
- Details: ${details || "Standard festival"}

Return ONLY valid JSON in this exact format:
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
- Make everything specific to ${festivalName} at ${location}`;

  const text = await groq(prompt, true);
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
};

export const getDashboardInsights = async ({ eventName, daysRemaining, tasks, departments, requirements, donations, etiquette }) => {
  const prompt = `You are an assistant for HKM Festival management app.

Event: ${eventName}
Days Remaining: ${daysRemaining}
Tasks: ${tasks.done} done, ${tasks.inProgress} in progress, ${tasks.pending} pending out of ${tasks.total}
Departments: ${departments.withHOD} have HOD, ${departments.missingHOD} missing HOD
Requirements: ${requirements.arranged} arranged, ${requirements.pending} pending
Donations: Rs.${donations.received} received vs Rs.${donations.budget} budget
Etiquette briefings: ${etiquette.briefed}/${etiquette.total} done

Give 4 short specific actionable suggestions for the event coordinator.
Return ONLY this JSON: { "insights": ["suggestion1", "suggestion2", "suggestion3", "suggestion4"] }`;

  const text = await groq(prompt, true);
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return parsed.insights || parsed;
};

export const generateWhatsAppSummary = async ({ eventName, daysRemaining, tasks, departments, requirements, donations, etiquette }) => {
  const prompt = `Write a WhatsApp status update for HKM festival coordinators.

Event: ${eventName}
Days Remaining: ${daysRemaining}
Tasks: ${tasks.done}/${tasks.total} done (${tasks.pct}%)
Departments: ${departments.total} total, ${departments.missingHOD} missing HOD
Requirements: ${requirements.arranged}/${requirements.total} arranged
Donations: Rs.${donations.received} received, budget Rs.${donations.totalBudget}
Etiquette briefings: ${etiquette.briefed}/${etiquette.total}

Write a short warm motivating WhatsApp message (max 120 words).
- Use *bold* for WhatsApp formatting
- Be encouraging and devotional in tone
- Highlight urgent items
- End with Hare Krishna!
- Plain text only, no JSON, no markdown`;

  return await groq(prompt, false);
};

export const generateHODReminders = async ({ eventName, daysRemaining, departments, tasks }) => {
  const hodData = departments.map(dept => {
    const deptTasks = tasks.filter(t =>
      (t.department || "").toLowerCase() === dept.name.toLowerCase()
    );
    const pending = deptTasks.filter(t => t.status !== "Done");
    const done = deptTasks.filter(t => t.status === "Done");
    return {
      dept: dept.name,
      hod: dept.hodName || dept.hod || "HOD",
      phone: dept.hodPhone || dept.contact || "",
      pending: pending.map(t => t.title),
      done: done.length,
      total: deptTasks.length,
    };
  }).filter(d => d.pending.length > 0);

  const prompt = `You are generating WhatsApp reminder messages for HKM festival HODs.

Event: ${eventName}
Days Remaining: ${daysRemaining}

HODs with pending tasks:
${JSON.stringify(hodData, null, 2)}

Generate a personalized WhatsApp message for each HOD.
Return ONLY this JSON:
{
  "reminders": [
    {
      "dept": "department name",
      "hod": "hod name",
      "phone": "phone number",
      "message": "personalized whatsapp message with *bold* formatting, mention specific pending tasks, end with Hare Krishna!"
    }
  ]
}`;

  const text = await groq(prompt, true);
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return parsed.reminders || [];
};
// cache bust Mon Jul  6 16:44:14 IST 2026
