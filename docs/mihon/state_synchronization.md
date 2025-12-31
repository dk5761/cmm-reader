# Mihon State Synchronization

This document explains the synchronization between the user interface (Seek Bar) and the internal reader state (Chapter/Page progress).

## 1. The Synchronization Loop

Mihon employs a **Unidirectional Data Flow** pattern where the `ReaderViewModel` acts as the single source of truth. However, since the user can interact with both the Scroll View (reading) and the Slider (seeking), the flow has two entry points that converge on the same state update loop.

### Flow Diagram

```mermaid
graph TD
    subgraph UI [User Interface]
        Slider[Seek Bar / Slider]
        Recycler[Webtoon RecyclerView]
    end

    subgraph Logic [Business Logic]
        Activity[Reader Activity]
        ViewModel[Reader ViewModel]
        State[StateFlow]
    end

    %% Read Path
    Recycler -- "User Scrolls" --> Activity
    Activity -- "onPageSelected()" --> ViewModel
    ViewModel -- "Update currentPage" --> State

    %% Seek Path
    Slider -- "User Drags" --> Activity
    Activity -- "moveToPage()" --> Recycler
    Recycler -- "Scroll to Position" --> Activity

    %% Feedback Loop
    State -- "Collect State" --> Activity
    Activity -- "Update Thumb Position" --> Slider
```

## 2. Detailed Sequences

### Scenario A: User Reads (Scrolling)

This is the passive update loop. As the user consumes content, the UI updates to reflect progress.

```mermaid
sequenceDiagram
    participant User
    participant View as WebtoonViewer
    participant VM as ReaderViewModel
    participant State as StateFlow
    participant UI as ChapterNavigator (Slider)

    User->>View: Scrolls Down
    View->>View: Detects new Visible Item
    View->>VM: onPageSelected(Page B)
    VM->>State: update { currentPage = B }
    State-->>UI: Emits New State
    UI->>UI: Moves Slider Thumb to B
```

### Scenario B: User Seeks (Sliding)

This is the active command loop. The user forces a state change via the UI.

```mermaid
sequenceDiagram
    participant User
    participant UI as ChapterNavigator (Slider)
    participant Act as ReaderActivity
    participant View as WebtoonViewer
    participant VM as ReaderViewModel

    User->>UI: Drags Slider to Page C
    UI->>Act: onPageIndexChange(C)
    Act->>View: moveToPage(C)
    View->>View: RecyclerView.scrollToPosition(C)

    Note right of View: This scroll triggers the standard detection<br/>logic, closing the loop.

    View->>VM: onPageSelected(Page C)
    VM->>VM: Update State (Source of Truth)
```

## 3. Conflict Resolution

To prevent jitters or conflicts (e.g., the slider trying to update while the user is still dragging it), the system relies on:

1.  **Single Source of Truth**: The slider does not maintain its own offset state; it always reads from the `ViewModel` state.
2.  **Smooth Scrolling**: When seeking, `WebtoonViewer` typically uses `scrollToPositionWithOffset` (instant jump) rather than smooth scrolling for long distances, which prevents intermediate `onPageSelected` events from firing wildly during the seek.
3.  **Haptic Feedback**: Provided during the drag to give physical confirmation of the "tick" (page change) before the visual jump occurs.
