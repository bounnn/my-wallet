const LAST_BACKUP_KEY = "my-wallet-last-backup";
const SNOOZE_KEY = "my-wallet-backup-snoozed";
const DAY = 24 * 60 * 60 * 1000;
// After this long without a backup, home asks for one
const STALE_AFTER = 30 * DAY;
const SNOOZE_FOR = 7 * DAY;

function readDate(key: string) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? new Date(saved) : undefined;
  } catch {
    return undefined;
  }
}
function writeDate(key: string, date: Date) {
  try {
    localStorage.setItem(key, date.toISOString());
  } catch {}
}

/**
 * The data only lives on this device, so backups are the safety net: when the last one was made (remembered per
 * device), saving a new one, and whether it's time to remind (never backed up, or over 30 days ago).
 */
export function useBackup() {
  const lastBackup = useState<Date | undefined>("last-backup", () => undefined);
  const snoozedAt = useState<Date | undefined>("backup-snoozed", () => undefined);
  const saving = useState("backup-saving", () => false);
  onMounted(() => {
    lastBackup.value ??= readDate(LAST_BACKUP_KEY);
    snoozedAt.value ??= readDate(SNOOZE_KEY);
  });

  const toast = useToast();

  // Returns true once the file is saved (false when the share sheet was closed or it failed)
  async function backUp() {
    saving.value = true;
    try {
      if (!(await saveBackup())) return false;
      lastBackup.value = new Date();
      writeDate(LAST_BACKUP_KEY, lastBackup.value);
      toast.add({ title: "Backup saved", description: "Keep the file somewhere safe", icon: "i-lucide-circle-check" });
      return true;
    } catch {
      toast.add({
        title: "Couldn't save the backup",
        description: "Try again. If it keeps failing, restart the app.",
        color: "error",
        icon: "i-lucide-circle-alert",
      });
      return false;
    } finally {
      saving.value = false;
    }
  }

  const isStale = computed(() => !lastBackup.value || Date.now() - lastBackup.value.getTime() > STALE_AFTER);
  const isSnoozed = computed(() => !!snoozedAt.value && Date.now() - snoozedAt.value.getTime() < SNOOZE_FOR);
  function snooze() {
    snoozedAt.value = new Date();
    writeDate(SNOOZE_KEY, snoozedAt.value);
  }

  const label = computed(() => {
    if (!lastBackup.value) return "Never backed up";
    const day = dayLabel(lastBackup.value);
    return day === formatDate(lastBackup.value) ? `Last backup on ${day}` : `Last backup ${day.toLowerCase()}`;
  });

  return { lastBackup, saving, backUp, isStale, isSnoozed, snooze, label };
}
