# WebSocket Events - Complete List

## Overview
All real-time updates in ChoreBlimey are handled via WebSocket events. Events are emitted to family rooms (`family:${familyId}`) so all family members receive updates instantly.

## Event Types

### Chore Events
- **`chore:created`** - Emitted when a parent creates a new chore
- **`chore:updated`** - Emitted when a parent updates a chore

### Assignment Events
- **`assignment:created`** - Emitted when a parent assigns a chore to a child
- **`assignment:deleted`** - Emitted when a parent removes a chore assignment

### Completion Events
- **`completion:created`** - Emitted when a child submits a chore completion
- **`completion:approved`** - Emitted when a parent approves a completion
- **`completion:rejected`** - Emitted when a parent rejects a completion

### Redemption Events
- **`redemption:created`** - Emitted when a child redeems a gift
- **`redemption:fulfilled`** - Emitted when a parent fulfills a redemption
- **`redemption:rejected`** - Emitted when a parent rejects a redemption (refunds stars)

### Gift Events
- **`gift:created`** - Emitted when a parent creates or adds a gift
- **`gift:updated`** - Emitted when a parent updates a gift

## Event Flow Examples

### Child Completes Chore
1. Child clicks "Mark as Done" → `POST /completions`
2. Server creates completion → Emits `completion:created`
3. All family members receive event → Dashboards refresh
4. Parent sees approval box immediately

### Parent Approves Completion
1. Parent clicks "Approve" → `POST /completions/:id/approve`
2. Server updates completion, credits wallet → Emits `completion:approved`
3. All family members receive event → Dashboards refresh
4. Child sees wallet update immediately

### Parent Creates Chore with Assignments
1. Parent creates chore → `POST /chores` → Emits `chore:created`
2. Parent creates assignments → `POST /assignments` (multiple) → Emits `assignment:created` (multiple)
3. All family members receive events → Dashboards refresh
4. Children see new chores immediately

## Implementation

### Backend (API)
All events are emitted from controllers using:
```typescript
const { io } = await import('../server.js')
if (io) {
  const { emitToFamily } = await import('../websocket/socket.js')
  emitToFamily(io, familyId, 'event:type', { data })
}
```

### Frontend (Web)
Dashboards listen for events using:
```typescript
const { socket, isConnected, on, off } = useSocket()

useEffect(() => {
  if (!socket || !isConnected) return
  
  const handleEvent = (data: any) => {
    loadDashboard() // Refresh data
  }
  
  on('event:type', handleEvent)
  return () => off('event:type', handleEvent)
}, [socket, isConnected, on, off, loadDashboard])
```

## Files Modified

### Backend
- `api/src/controllers/chores.ts` - `chore:created`, `chore:updated`
- `api/src/controllers/assignments.ts` - `assignment:created`, `assignment:deleted`
- `api/src/controllers/completions.ts` - `completion:created`, `completion:approved`, `completion:rejected`
- `api/src/controllers/rewards.ts` - `redemption:created`, `redemption:fulfilled`, `redemption:rejected`
- `api/src/controllers/familyGifts.ts` - `gift:created`, `gift:updated`

### Frontend
- `web/src/pages/ParentDashboard.tsx` - Listens for all events
- `web/src/pages/ChildDashboard.tsx` - Listens for all events

## Testing

Test each event by:
1. Opening parent dashboard in one tab/browser
2. Opening child dashboard in another tab/browser
3. Performing the action (create chore, approve completion, etc.)
4. Verifying the other dashboard updates immediately

## Future Events

Additional events that could be added:
- `wallet:updated` - When wallet balance changes
- `child:joined` - When a child joins the family
- `family:updated` - When family settings change
- `bid:placed` - When a child places a bid
- `bid:won` - When a child wins a bid

