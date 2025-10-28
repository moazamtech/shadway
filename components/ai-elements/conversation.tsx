"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback, useEffect } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

// Custom CSS for conversation scrolling
const conversationScrollStyles = `
  .conversation-scroll-container {
    height: 100% !important;
    width: 100% !important;
    overflow-y: scroll !important;
    overflow-x: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    scroll-behavior: smooth !important;
    position: relative !important;
  }

  /* Scrollbar styling for webkit browsers */
  .conversation-scroll-container::-webkit-scrollbar {
    width: 12px !important;
  }

  .conversation-scroll-container::-webkit-scrollbar-track {
    background: transparent !important;
    margin: 4px 0 !important;
  }

  .conversation-scroll-container::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.6) !important;
    border-radius: 6px !important;
    border: 3px solid transparent !important;
    background-clip: content-box !important;
  }

  .conversation-scroll-container::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.9) !important;
    background-clip: content-box !important;
  }

  .conversation-scroll-container::-webkit-scrollbar-thumb:active {
    background: hsl(var(--muted-foreground)) !important;
    background-clip: content-box !important;
  }

  /* Firefox scrollbar */
  .conversation-scroll-container {
    scrollbar-color: hsl(var(--muted-foreground) / 0.6) transparent !important;
    scrollbar-width: thin !important;
  }

  /* Ensure smooth content flow */
  .stick-to-bottom-root {
    height: 100% !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .stick-to-bottom-content {
    flex: 1 !important;
    overflow-y: visible !important;
    overflow-x: hidden !important;
    width: 100% !important;
  }

  /* Enable mouse wheel scrolling */
  .conversation-scroll-container {
    -webkit-user-select: text !important;
    user-select: text !important;
  }

  /* Smooth scrolling for all elements */
  * {
    scroll-behavior: smooth !important;
  }
`;

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => {
  // Inject custom scroll styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = conversationScrollStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Handle mouse wheel scrolling
  const handleWheel = useCallback((e: WheelEvent) => {
    const container = e.currentTarget as HTMLElement;
    if (container) {
      // Allow default scroll behavior - don't prevent it
      container.scrollTop += e.deltaY;
    }
  }, []);

  return (
    <StickToBottom
      className={cn("conversation-scroll-container relative flex-1 overflow-y-scroll", className)}
      initial="smooth"
      resize="smooth"
      role="log"
      onWheel={handleWheel as any}
      {...props}
    />
  );
};

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content className={cn("p-4", className)} {...props} />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
