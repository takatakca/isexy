import { useState } from "react";
import { Calendar, Clock, X, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";

interface CallScheduleModalProps {
  open: boolean;
  onClose: () => void;
  matchId: string;
  recipientId: string;
  recipientName: string;
  currentUserId: string;
}

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
];

export function CallScheduleModal({
  open,
  onClose,
  matchId,
  recipientId,
  recipientName,
  currentUserId,
}: CallScheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    setScheduling(true);

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

    try {
      const { error } = await supabase.from("scheduled_calls").insert({
        match_id: matchId,
        scheduler_id: currentUserId,
        recipient_id: recipientId,
        scheduled_at: scheduledAt.toISOString(),
        status: "pending",
      });

      if (error) throw error;

      // Send notification to recipient
      await supabase.functions.invoke("send-push-notification", {
        body: {
          userId: recipientId,
          title: "📅 Call Scheduled",
          body: `${recipientName} wants to video call you on ${format(scheduledAt, "MMM d 'at' h:mm a")}`,
          data: {
            type: "scheduled_call",
            matchId,
            scheduledAt: scheduledAt.toISOString(),
          },
        },
      });

      toast.success(`Call scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}`);
      onClose();
    } catch (error) {
      console.error("Failed to schedule call:", error);
      toast.error("Failed to schedule call");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Schedule Video Call
          </DialogTitle>
          <DialogDescription>
            Pick a date and time to video call {recipientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Calendar */}
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Select Date
            </label>
            <CalendarPicker
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
              className="rounded-md border"
            />
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Select Time
              </label>
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedTime === time
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-muted border-border"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!selectedDate || !selectedTime || scheduling}
          >
            {scheduling ? "Scheduling..." : "Schedule Call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
