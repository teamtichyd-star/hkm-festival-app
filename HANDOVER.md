# HKM Festival App - Handover Note

## Project
- Repo: https://github.com/teamtichyd-star/hkm-festival-app
- Live: https://hkm-festival-app.web.app
- Firebase Project: hkm-festival-app
- Local Path: ~/hkm-apps/hkm-festival-app
- Super Admin: teamtic.hyd@gmail.com (Hari Bhajana Dasa)

## Tech Stack
React + Vite + Tailwind CSS + Firebase (Auth + Firestore + Hosting) + Groq AI

## Security
- Groq key stored in .env.local only (never in source code)
- Deploy command: cd ~/hkm-apps/hkm-festival-app && export VITE_GROQ_API_KEY=$(grep VITE_GROQ_API_KEY .env.local | cut -d= -f2) && npm run build && firebase deploy --only hosting
- Verify no keys in source: grep -rn "gsk_" src/

## Working Tabs (10 tabs)
1. Dashboard (home tab) - event summary, progress, WhatsApp share
2. Departments - grouped by category, CRUD, HOD picker from users, team picker, WhatsApp
3. Task Tracker - phases (pre/event/post), status, department-wise
4. Requirements - items, status, cost tracking
5. Crowd and Route - checkpoints, estimates
6. Prasadam - Maha (menu + adult/child counts, child=0.5), Donna (variety+count), AI Estimates
7. Etiquette - rules list
8. Donations - donor name/phone/gothra/address, thank you WhatsApp, budget tracking
9. User Management - Google login, approval, roles, event access, language preference (English/Telugu)
10. AI Assistant - locked to Super Admin, 4 sections: Action Required, HOD Nudge, Missing Items, Smart Planner

## Event Awareness
- Color-coded header per event (different color per event)
- Sticky banner showing current event name
- Prevents accidental edits on wrong event

## New Event Behavior
- Clones current event as template
- Copies: departments, tasks, requirements, checkpoints, etiquette, prasadam structure
- Does NOT copy: users, donors, amounts, progress, status
- All copied tasks reset to Not Started, HOD fields cleared

## Department Groups
Coordination, Deities and Ratha, Prasadam, VIP and Guests, Spiritual, Cultural and Support, Logistics and Safety, Publicity and Outreach

## HOD Nudge Rules
- WhatsApp with phone prefilled
- Only Hare Krishna greeting (no Hello/Namaste)
- Line-by-line format (no paragraphs)
- Dynamic volunteer count per department based on crowd/service type
- End with event name not app name
- Language from user preferredLanguage field

## AI Rules
- AI tab visible to all, actions (Add/Reject/Edit) only for Super Admin
- Non-admin sees locked screen
- AI should assist, never replace normal CRUD
- Groq llama-3.3-70b-versatile model
- AI estimates in Prasadam persist in Firestore

## PENDING WORK - Start Here

### Priority 1: Customizable Permissions Panel
- Build permissions matrix UI with checkboxes
- Roles: Super Admin, SPOC, HOD, Volunteer
- Permissions: create/edit/delete for events, departments, tasks, requirements, users
- Save to Firestore, app reads before allowing actions
- Super Admin: full access
- SPOC: event-level management
- HOD: department-level, can delete own dept tasks
- Volunteer: view only, update own task status

### Priority 2: Event-Level User Filtering
- Inside an event, show only users assigned to that event
- Department HOD picker shows only event-assigned users
- SPOC can give access within their event
- Only Super Admin can delete events and departments
- Backup before implementing

### Priority 3: Preserve All Existing CRUD
- Nothing from existing should break
- AI/template must not remove manual create/edit/delete
- Test all tabs after permission changes

## Files Likely Involved
- src/pages/tabs/Users.jsx
- src/pages/tabs/Departments.jsx
- src/pages/tabs/Tasks.jsx
- src/components/Sidebar.jsx
- src/App.jsx
- New: src/utils/permissions.js or similar

## Prompt For Next Chat
Continue HKM Festival App from HANDOVER.md in repo. Start with permissions panel plus event-level user filtering. Do not break existing CRUD. Give terminal-only single commands.
