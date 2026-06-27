-- Dead-code cleanup: drop the admin "feeds v1" RPCs. These were superseded by admin_dashboard_overview
-- (one round-trip for the whole command center); their DAL wrappers (getPlatformStats /
-- getRecentBookings / getRecentActivity) and the components that rendered them (activity-feed,
-- recent-bookings-table) are removed in the same change, so nothing calls these anymore.

drop function if exists public.admin_platform_stats();
drop function if exists public.admin_recent_bookings();
drop function if exists public.admin_recent_activity();
