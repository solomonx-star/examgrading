import {
  getRecentNotifications,
  getUnreadCount,
} from "@/lib/notifications";
import { BellDropdown } from "./BellDropdown";

export async function NotificationBell({ userId }: { userId: string }) {
  const [items, unread] = await Promise.all([
    getRecentNotifications(userId, 10),
    getUnreadCount(userId),
  ]);
  const initialData = {
    unread,
    items: items.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  };
  return <BellDropdown initialData={initialData} />;
}
