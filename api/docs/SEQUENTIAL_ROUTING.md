# Sequential Call Routing

This document describes the sequential call routing feature implemented in the MedContact Telephony system.

## Overview

Sequential call routing ensures incoming calls are handled efficiently by trying available agents one-by-one until someone answers. If no agents are available or all decline, callers are placed in a hold queue with music until an agent becomes available.

### Key Features

- **Sequential Routing**: Calls ring agents one at a time (15 seconds each) until answered
- **Longest Idle First**: Agents who haven't taken a call the longest get priority
- **Same Company**: Only routes to agents within the same company
- **Queue Fallback**: Callers wait with hold music if no agents available
- **Auto-Dequeue**: When an agent becomes available, queued callers are automatically connected

---

## How It Works

### Call Flow Diagram

```
Incoming Call
      │
      ▼
┌─────────────────────────────┐
│  Get available agents       │
│  (ordered by longest idle)  │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Agents available?          │
└─────────────────────────────┘
      │
      ├── YES ──▶ Dial first agent (15s timeout)
      │                │
      │                ▼
      │          ┌─────────────┐
      │          │  Answered?  │
      │          └─────────────┘
      │                │
      │                ├── YES ──▶ Call Connected
      │                │
      │                ▼ NO
      │          ┌─────────────────┐
      │          │  More agents?   │
      │          └─────────────────┘
      │                │
      │                ├── YES ──▶ Dial next agent
      │                │
      │                ▼ NO
      │          Put caller in queue
      │                │
      ▼                ▼
┌─────────────────────────────┐
│  Put caller in queue        │
│  (hold music plays)         │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Agent becomes available    │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Dequeue oldest caller      │
│  and connect to agent       │
└─────────────────────────────┘
```

### Routing Logic

1. **Incoming Call**: Twilio webhook triggers `/twilio/incoming-call`
2. **Agent Selection**: System queries available agents in the company, sorted by `last_call_ended_at` (oldest first)
3. **Sequential Dial**: First agent is dialed with 15-second timeout
4. **Callback Handling**: If no answer, `/twilio/dial-callback` is triggered
5. **Next Agent**: System tries the next available agent
6. **Queue Fallback**: If all agents tried or none available, caller enters queue
7. **Dequeue**: When an agent's status changes to "available", system checks for queued calls

---

## Database Schema

### New Table: `call_queue`

Tracks callers waiting in queue and routing state.

```sql
CREATE TABLE call_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    call_sid VARCHAR(255) NOT NULL UNIQUE,  -- Twilio call identifier
    company_id INT NOT NULL,                 -- Company the call belongs to
    from_number VARCHAR(50) NOT NULL,        -- Caller's phone number
    to_number VARCHAR(50) NOT NULL,          -- Called number (Twilio number)
    status VARCHAR(50) DEFAULT 'waiting',    -- waiting, routing, connected, abandoned
    current_agent_index INT DEFAULT 0,       -- Index of current agent being tried
    agents_tried TEXT,                       -- JSON array of agent IDs already tried
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
```

### Modified Table: `users`

Added column for "longest idle first" prioritization.

```sql
ALTER TABLE users ADD COLUMN last_call_ended_at TIMESTAMP NULL DEFAULT NULL;
```

This column is updated when an agent completes a call, allowing the system to prioritize agents who have been idle the longest.

---

## API Endpoints

### Twilio Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/twilio/incoming-call` | POST/GET | Entry point for incoming calls. Initiates sequential routing. |
| `/twilio/dial-callback` | POST/GET | Called by Twilio after each dial attempt. Handles retry logic. |
| `/twilio/queue-wait` | POST/GET | Returns TwiML for hold music while caller waits. |
| `/twilio/dequeue-dial` | POST/GET | Dials an agent for a dequeued call. |

### Internal Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/status` | POST | Updates agent status. When set to "available", checks for queued calls. |
| `/api/calls/{call_sid}` | PUT | Updates call record. On completion, updates agent's `last_call_ended_at`. |

---

## Configuration

### Required Environment Variables

```env
# Twilio Credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Webhook URL (your public URL)
WEBHOOK_BASE_URL=https://your-domain.ngrok-free.dev
```

### Twilio Console Setup

1. Go to your TwiML App in Twilio Console
2. Set the Voice webhook URL to: `{WEBHOOK_BASE_URL}/twilio/incoming-call`
3. Ensure the method is set to POST

---

## Testing Guide

### Test Scenarios

#### 1. Single Agent Available
- **Setup**: One agent logged in with status "available"
- **Action**: Make an incoming call
- **Expected**: Call rings the agent's browser

#### 2. Sequential Routing
- **Setup**: Multiple agents logged in with status "available"
- **Action**: Make an incoming call, first agent doesn't answer
- **Expected**: After 15 seconds, call rings the next agent

#### 3. Queue Fallback
- **Setup**: No agents available (all offline or busy)
- **Action**: Make an incoming call
- **Expected**: Caller hears "All agents are currently busy. Please hold..." followed by hold music

#### 4. Auto-Dequeue
- **Setup**: Caller waiting in queue
- **Action**: Agent changes status to "available"
- **Expected**: Queued caller is automatically connected to the agent

#### 5. Longest Idle First
- **Setup**: Agent A completed a call 5 minutes ago, Agent B completed a call 10 minutes ago
- **Action**: New incoming call
- **Expected**: Agent B rings first (longer idle time)

### Checking Logs

The server logs routing activity with emojis for easy identification:

```
📞 Incoming call: From=+1234567890, To=+0987654321, CallSID=CA...
📞 Starting sequential routing, first agent: agent001 (idle since: 2024-01-15 10:30:00)
📞 Dialing agent agent001 with 15s timeout
📞 Dial callback: CallSID=CA..., DialCallStatus=no-answer
📞 Trying next agent: agent002
✅ Call CA... was answered
📋 No waiting calls for company 1
```

---

## Troubleshooting

### Common Issues

#### Calls not routing to agents
- Verify agents have status "available" in the database
- Check `WEBHOOK_BASE_URL` is accessible from the internet
- Ensure Twilio TwiML App webhook is configured correctly

#### Queue not working
- Verify `TWILIO_AUTH_TOKEN` is set (required for dequeue operations)
- Check server logs for errors when redirecting queued calls

#### Agents not receiving calls after becoming available
- The `checkQueueForAgent` function runs asynchronously
- Check logs for "Found waiting call" or "No waiting calls" messages

### Database Queries for Debugging

```sql
-- Check agent statuses
SELECT u.id, u.agent_id, u.firstname, ast.status, u.last_call_ended_at
FROM users u
LEFT JOIN agent_status ast ON u.id = ast.user_id
WHERE ast.created_at = (
    SELECT MAX(created_at) FROM agent_status WHERE user_id = u.id
);

-- Check queued calls
SELECT * FROM call_queue WHERE status = 'waiting' ORDER BY created_at;

-- Check recent call queue activity
SELECT * FROM call_queue ORDER BY updated_at DESC LIMIT 10;
```

---

## Future Enhancements

The current implementation supports sequential routing. Future enhancements could include:

- **Skills-based routing**: Route calls based on agent skills/specializations
- **Department-based routing**: Route to specific departments based on IVR selection
- **Priority queuing**: VIP callers get priority in the queue
- **Estimated wait time**: Announce estimated wait time to queued callers
- **Queue callbacks**: Allow callers to request a callback instead of waiting

---

## Files Reference

| File | Description |
|------|-------------|
| `api/main.go` | Main API server with routing handlers |
| `api/schema.sql` | Database schema definitions |
| `api/queries.sql` | SQL queries for sqlc |
| `api/db/queries.sql.go` | Generated Go query functions |
| `api/db/models.go` | Generated Go model structs |
