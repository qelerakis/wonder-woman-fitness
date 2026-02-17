# Confirmation Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 2 `window.confirm()` calls in `SessionDetailClient.tsx` with a reusable `ConfirmationModal` component that wraps the existing `Modal.tsx`.

**Architecture:** A thin `ConfirmationModal` wrapper around `Modal` that standardizes destructive confirmation dialogs (title, message, confirm/cancel buttons, loading state). Two state flags in `SessionDetailClient` toggle the modals instead of calling `confirm()`.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library. Uses existing `Modal` and `Button` components.

---

### Task 1: Write failing tests for ConfirmationModal

**Files:**
- Create: `components/ui/__tests__/ConfirmationModal.test.tsx`

**Step 1: Write the test file**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmationModal } from "../ConfirmationModal";

function renderConfirmModal(
  props: Partial<React.ComponentProps<typeof ConfirmationModal>> = {}
): ReturnType<typeof render> {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Confirm Action",
    message: "Are you sure?",
    confirmLabel: "Confirm",
  };
  return render(<ConfirmationModal {...defaultProps} {...props} />);
}

describe("ConfirmationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the modal with title and message when open", () => {
      renderConfirmModal({
        title: "Delete Item",
        message: "This cannot be undone.",
      });
      expect(screen.getByRole("dialog")).toBeDefined();
      expect(screen.getByText("Delete Item")).toBeDefined();
      expect(screen.getByText("This cannot be undone.")).toBeDefined();
    });

    it("does not render when isOpen is false", () => {
      renderConfirmModal({ isOpen: false });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders the confirm button with the given label", () => {
      renderConfirmModal({ confirmLabel: "Delete Forever" });
      expect(screen.getByText("Delete Forever")).toBeDefined();
    });

    it("renders a Cancel button", () => {
      renderConfirmModal();
      expect(screen.getByText("Cancel")).toBeDefined();
    });
  });

  describe("confirm variant", () => {
    it("defaults to danger variant on the confirm button", () => {
      renderConfirmModal({ confirmLabel: "Delete" });
      const btn = screen.getByText("Delete");
      expect(btn.className).toContain("bg-error-600");
    });

    it("applies warning variant when specified", () => {
      renderConfirmModal({ confirmLabel: "Proceed", confirmVariant: "warning" });
      const btn = screen.getByText("Proceed");
      expect(btn.className).toContain("bg-warning-600");
    });
  });

  describe("interactions", () => {
    it("calls onConfirm when the confirm button is clicked", () => {
      const onConfirm = vi.fn();
      renderConfirmModal({ onConfirm, confirmLabel: "Delete" });
      fireEvent.click(screen.getByText("Delete"));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the Cancel button is clicked", () => {
      const onClose = vi.fn();
      renderConfirmModal({ onClose });
      fireEvent.click(screen.getByText("Cancel"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape is pressed", () => {
      const onClose = vi.fn();
      renderConfirmModal({ onClose });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading state", () => {
    it("disables both buttons when loading is true", () => {
      renderConfirmModal({ loading: true, confirmLabel: "Delete" });
      const confirmBtn = screen.getByText("Delete").closest("button");
      const cancelBtn = screen.getByText("Cancel").closest("button");
      expect(confirmBtn?.disabled).toBe(true);
      expect(cancelBtn?.disabled).toBe(true);
    });

    it("does not disable buttons when loading is false", () => {
      renderConfirmModal({ loading: false, confirmLabel: "Delete" });
      const confirmBtn = screen.getByText("Delete").closest("button");
      const cancelBtn = screen.getByText("Cancel").closest("button");
      expect(confirmBtn?.disabled).toBe(false);
      expect(cancelBtn?.disabled).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- components/ui/__tests__/ConfirmationModal.test.tsx`
Expected: FAIL — `ConfirmationModal` module not found.

---

### Task 2: Implement ConfirmationModal

**Files:**
- Create: `components/ui/ConfirmationModal.tsx`

**Step 1: Write the component**

```tsx
"use client";

import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "warning";
  loading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmVariant = "danger",
  loading = false,
}: ConfirmationModalProps): React.ReactElement | null {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-surface-300">{message}</p>
        <div className="flex items-center gap-2">
          <Button
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export type { ConfirmationModalProps };
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- components/ui/__tests__/ConfirmationModal.test.tsx`
Expected: All 10 tests PASS.

**Step 3: Commit**

```bash
git add components/ui/ConfirmationModal.tsx components/ui/__tests__/ConfirmationModal.test.tsx
git commit -m "feat: add reusable ConfirmationModal component with tests"
```

---

### Task 3: Replace confirm() in SessionDetailClient

**Files:**
- Modify: `app/(owner)/owner/session/[id]/SessionDetailClient.tsx`

**Step 1: Add state flags and import**

Add import at the top:
```tsx
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
```

Add two state variables after the existing `showDeleteSlotModal` state (line 69):
```tsx
const [showCancelModal, setShowCancelModal] = useState(false);
const [showDeleteModal, setShowDeleteModal] = useState(false);
```

**Step 2: Refactor handleCancelSession**

Replace the current `handleCancelSession` (lines 109-131) with:

```tsx
async function handleCancelConfirmed(): Promise<void> {
  setCancelling(true);
  try {
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.ok) {
      setShowCancelModal(false);
      addToast({ type: "success", title: "Session cancelled" });
      router.refresh();
    } else {
      addToast({ type: "error", title: "Failed to cancel session" });
    }
  } catch {
    addToast({ type: "error", title: "Network error" });
  } finally {
    setCancelling(false);
  }
}
```

**Step 3: Refactor handleDeleteSession**

Replace the current `handleDeleteSession` (lines 133-157) with:

```tsx
async function handleDeleteConfirmed(): Promise<void> {
  setDeleting(true);
  try {
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setShowDeleteModal(false);
      addToast({ type: "success", title: "Session deleted" });
      router.push("/owner/schedule");
    } else {
      addToast({ type: "error", title: "Failed to delete session" });
    }
  } catch {
    addToast({ type: "error", title: "Network error" });
  } finally {
    setDeleting(false);
  }
}
```

**Step 4: Update button onClick handlers**

Change the Cancel Session button (line 257):
```tsx
onClick={() => setShowCancelModal(true)}
```

Change the Delete Session button (line 266):
```tsx
onClick={() => setShowDeleteModal(true)}
```

Remove `loading={cancelling}` from the Cancel Session button and `loading={deleting}` from the Delete Session button (loading is now shown inside the modal).

**Step 5: Add the modals before the closing `</div>` of the component**

Right before the closing `</div>` (before the `DeleteRecurringSlotModal`):

```tsx
<ConfirmationModal
  isOpen={showCancelModal}
  onClose={() => setShowCancelModal(false)}
  onConfirm={handleCancelConfirmed}
  title="Cancel Session"
  message="Cancel this session? All assigned members will be notified."
  confirmLabel="Cancel Session"
  loading={cancelling}
/>

<ConfirmationModal
  isOpen={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  onConfirm={handleDeleteConfirmed}
  title="Delete Session"
  message="Permanently delete this session? This cannot be undone."
  confirmLabel="Delete"
  loading={deleting}
/>
```

**Step 6: Commit**

```bash
git add app/(owner)/owner/session/[id]/SessionDetailClient.tsx
git commit -m "feat: replace window.confirm() with ConfirmationModal in SessionDetailClient"
```

---

### Task 4: Verify zero confirm() usage and run full test suite

**Step 1: Verify no confirm() calls remain**

Run: `grep -r "confirm(" --include="*.tsx" --include="*.ts" app/ components/ lib/`
Expected: Zero matches (exclude test files and the ConfirmationModal component itself).

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

**Step 3: Lint**

Run: `npm run lint`
Expected: Zero new warnings (4 pre-existing are OK).

**Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass (615 existing + 10 new = 625).

**Step 5: Final commit (if any fixes needed)**

If all green, no further commits needed.
