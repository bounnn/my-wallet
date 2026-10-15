// An error whose message is written for people (e.g. "This backup has no wallets"); shown as is
export class UserError extends Error {}

// Text for an error toast: our own messages as written, anything from the browser or database in plain words
export function errorText(error: unknown) {
  if (error instanceof UserError) return error.message;
  if (error instanceof Error && error.name === "QuotaExceededError") {
    return "This phone is out of storage space. Free some up and try again.";
  }
  return "Something went wrong on this device. Try again, or restart the app if it keeps happening.";
}
