# Using Talweg

[Documentation](README.md) · [Русский](user-guide.ru.md)

## Your first board

Choose **Blank Canvas** on the home screen, or open the template library. A template remains a preview until you edit or explicitly save it. Each edited copy is independent.

Click the title at the top to rename the board. Use **Add to canvas** in the bottom toolbar, or right-click empty space to choose an element. The catalogue includes shapes, text, tables, checklists, images and Markdown notes.

![The template library](media/templates.png)

## Move around

Drag empty space with the hand tool, hold Space while dragging, or use the middle mouse button. In automatic wheel mode, a mouse wheel zooms and a trackpad scroll pans. Pinch or Ctrl + wheel zooms around the pointer when the operating system sends those gestures.

The bottom-right controls adjust canvas zoom and fit the page contents into view. **Settings → General → Interface scale** changes the menus and panels instead. Ctrl + plus, Ctrl + minus and Ctrl + 0 adjust or reset interface scale. If wheel detection feels wrong, choose a fixed pan or zoom action in **Settings → Canvas**.

## Select and arrange

Click an object to select it. Shift-click adds to the selection; dragging a selection box selects several objects. Drag a resize handle to change size. Text scales with its containing object.

Use the selection controls or context menu to align, distribute, group or tidy objects. Hover **Tidy selection** to inspect the proposed layout, then click to apply it. Undo is available if the result does not suit your board. Grid snapping is off by default and can be enabled in canvas settings.

A group keeps its children together when moved. Ungroup it when you need to rearrange them independently. Copy and paste a selection into another board to reuse it, including its internal connections and image assets.

## Write and format

Double-click text to edit it. Select a word or a letter to format just that range using the text toolbar: bold, italic, underline, strike-through, size, colour or link. Ctrl + B, I and U apply to the selected range.

For a website link, select text, choose the link control and enter the address. You can also choose a page and object on the same board as the target. Click a link after leaving edit mode, or use Ctrl + click while editing.

Right-click an object to change its base text colour, alignment, fill and border. Whole-object styling and selected-text formatting are separate operations; a previously coloured word can keep its own colour.

## Connect ideas

Use the arrow tool or drag from an object’s connection point. Select a connection to move its endpoints or change its line style. Double-click a connection, or right-click it, to add a description. Clear the description field to remove the label.

Labels are placed near available space on the connection. In a crowded diagram they may move to one side and use a small leader line. For a longer explanation, attach a note to an object instead.

## Notes, pictures and formulas

Right-click an object and choose **Add description** to attach a note only where it is useful. The document button opens the editor. A standalone Markdown element is also available in the catalogue.

The editor has writing and preview views. Markdown supports headings, lists, quotes, links, code blocks and math. Use `$a^2 + b^2 = c^2$` for inline math or a separate `$$` block for a displayed equation. This is LaTeX math rendering, not a symbolic calculator.

![A math lesson with independent practice and solutions pages](media/math-light.png)

Add local images through the catalogue, drag and drop, or paste. Notes can import and download `.md` files. Local pictures are included in the `.talweg` project; downloading a note embeds its local images. Raw HTML is not executed, and remote Markdown images are not loaded automatically.

## Tables and plans

Edit a table cell directly on the canvas. Its row and column controls change the table structure. Right-click a cell to style it; choose **Whole table** to style the table instead. Cell-specific formatting takes precedence over the table defaults.

Checklists have an editable title, task text and completion boxes. The planning templates combine them with notes and tables so the reason for a task stays nearby.

![A planning board](media/planning-dark.png)

## Pages and modes

Use the page bar at the bottom-left to add, rename, switch or delete pages. Pages have independent content. Text links can point to an object on another page of the same board.

The top canvas menu switches between whiteboard, diagrams and mind map. In mind-map mode, select a thought and press Tab to add a child, or Enter to add a sibling. Changing the mode does not turn a page into a separate project.

## Save and share

Check the save status under the title before closing. Ctrl + S saves a `.talweg` copy; **Export PNG** creates an image of the page. An image export cannot be reopened as an editable project.

For live editing, use **Collaborate**. Everyone the host approves can edit. Before leaving as a guest, use **Save an independent copy** if you want a board in your own library. See [collaboration](collaboration.md).

For local history, checkpoints and backups, see [files and recovery](files-and-recovery.md).

## Keyboard reference

Canvas shortcuts act outside text fields. While typing, normal text-editing keys take precedence. Ctrl shortcuts also accept Cmd where the browser/platform provides it; macOS desktop support has not been validated.

| Shortcut | Action |
| --- | --- |
| V / H / P | Select / hand / pen |
| R / D | Rectangle / diamond |
| T / Shift + T / B | Text / capsule / cylinder |
| A / S / C | Arrow / sticky note / card |
| Space + drag / middle-button drag | Pan |
| Ctrl + A | Select objects on the current page |
| Shift + click | Add an object to the selection |
| Arrow keys / Shift + arrow keys | Nudge by 1 / 10 canvas units |
| Ctrl + C / X / V | Copy / cut / paste selection |
| Ctrl + D | Duplicate selection |
| Ctrl + G / Ctrl + Shift + G | Group / ungroup |
| Ctrl + Z / Ctrl + Shift + Z or Ctrl + Y | Undo / redo |
| Ctrl + S | Save project copy |
| Ctrl + plus / minus / 0 | Increase / decrease / reset interface scale |
| Tab / Enter in mind-map mode | Child / sibling thought |
| Delete / Backspace | Remove selected objects |
| Escape | Cancel an interaction or leave the current tool |
