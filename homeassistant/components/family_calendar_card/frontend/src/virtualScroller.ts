import { render, TemplateResult } from "lit";

interface VirtualScrollerOptions {
  container: HTMLElement;
  headerContainer: HTMLElement;
  itemWidth: number;
  overscan: number;
  renderItem: (index: number) => TemplateResult;
  renderHeader: (index: number) => TemplateResult;
  onScroll: (state: { left: number; top: number }) => void;
}

export class VirtualScroller {
  private options: VirtualScrollerOptions;
  private visibleItems: Set<number> = new Set();
  private observer: ResizeObserver;
  private scrollTimeout: number | null = null;
  private totalItems = 1000; // Virtually infinite

  constructor(options: VirtualScrollerOptions) {
    this.options = options;
    this.observer = new ResizeObserver(() => this.update());
    this.observer.observe(options.container);

    this.options.container.addEventListener("scroll", this.handleScroll);

    // Force initial render
    requestAnimationFrame(() => {
      const { container, itemWidth } = this.options;
      const { clientWidth } = container;

      // Calculate initial visible range
      const startIndex = 0;
      const endIndex = Math.ceil(clientWidth / itemWidth) + 2;

      // Add initial items
      for (let i = startIndex; i <= endIndex; i++) {
        this.addItem(i);
        this.visibleItems.add(i);
      }
    });
  }

  private handleScroll = () => {
    if (this.scrollTimeout) {
      window.cancelAnimationFrame(this.scrollTimeout);
    }

    this.scrollTimeout = window.requestAnimationFrame(() => {
      const { scrollLeft, scrollTop } = this.options.container;
      this.options.onScroll({ left: scrollLeft, top: scrollTop });
      this.update();
    });
  };

  private update() {
    const { container, itemWidth, overscan } = this.options;
    const { scrollLeft, clientWidth } = container;

    const startIndex = Math.max(
      0,
      Math.floor(scrollLeft / itemWidth) - overscan,
    );
    const endIndex = Math.min(
      this.totalItems,
      Math.ceil((scrollLeft + clientWidth) / itemWidth) + overscan,
    );

    const newVisibleItems = new Set<number>();
    for (let i = startIndex; i <= endIndex; i++) {
      newVisibleItems.add(i);
    }

    // Remove items that are no longer visible
    for (const index of this.visibleItems) {
      if (!newVisibleItems.has(index)) {
        this.removeItem(index);
      }
    }

    // Add new visible items
    for (const index of newVisibleItems) {
      if (!this.visibleItems.has(index)) {
        this.addItem(index);
      }
    }

    this.visibleItems = newVisibleItems;
  }

  private addItem(index: number) {
    const { container, headerContainer, itemWidth, renderItem, renderHeader } =
      this.options;

    // Create and position the main content item
    const item = document.createElement("div");
    item.style.cssText = `
      position: absolute;
      left: ${index * itemWidth}px;
      width: ${itemWidth}px;
      height: 100%;
      display: flex;
      flex-direction: column;
      min-width: ${itemWidth}px;
      box-sizing: border-box;
    `;
    item.setAttribute("data-index", index.toString());
    render(renderItem(index), item);
    container.appendChild(item);

    // Create and position the header item
    const headerItem = document.createElement("div");
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      .virtual-slide {
        width: 100% !important;
        min-width: 100% !important;
        box-sizing: border-box !important;
      }
    `;
    headerItem.appendChild(styleSheet);

    headerItem.style.cssText = `
      position: absolute;
      left: ${index * itemWidth}px;
      width: ${itemWidth}px;
      height: 100%;
      display: flex;
      flex-direction: column;
      min-width: ${itemWidth}px;
      box-sizing: border-box;
    `;
    headerItem.setAttribute("data-index", index.toString());
    render(renderHeader(index), headerItem);
    headerContainer.appendChild(headerItem);
  }

  private removeItem(index: number) {
    const { container, headerContainer } = this.options;

    container
      .querySelectorAll(`[data-index="${index}"]`)
      .forEach((el) => el.remove());
    headerContainer
      .querySelectorAll(`[data-index="${index}"]`)
      .forEach((el) => el.remove());
  }

  public updateItemWidth(newWidth: number) {
    this.options.itemWidth = newWidth;
    this.update();

    const updateElementStyle = (element: Element) => {
      const index = parseInt(element.getAttribute("data-index") || "0", 10);
      const isHeader = element.parentElement === this.options.headerContainer;

      (element as HTMLElement).style.cssText = `
        position: absolute;
        left: ${index * newWidth}px;
        width: ${newWidth}px;
        height: 100%;
        display: flex;
        flex-direction: column;
        flex: 1;
        box-sizing: border-box;
      `;
    };

    // Update existing items
    this.options.container
      .querySelectorAll("[data-index]")
      .forEach(updateElementStyle);
    this.options.headerContainer
      .querySelectorAll("[data-index]")
      .forEach(updateElementStyle);
  }

  public getItemWidth(): number {
    return this.options.itemWidth;
  }

  destroy() {
    this.observer.disconnect();
    this.options.container.removeEventListener("scroll", this.handleScroll);
  }
}
