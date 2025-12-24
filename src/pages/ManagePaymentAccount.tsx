import { AuthLayout } from "@/components/AuthLayout";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ManagePaymentAccount = () => {
  const navigate = useNavigate();

  return (
    <AuthLayout showBack variant="gray">
      <div className="p-4">
        <h2 className="text-lg font-bold text-foreground mb-4">Contact Us</h2>
        
        <div className="bg-card rounded-lg">
          <button
            onClick={() => navigate("/help-support")}
            className="w-full p-4 flex items-center justify-between"
          >
            <span className="text-foreground">Help</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mt-4 px-1">
          Get answers to any of your questions about your purchases or payments.
        </p>
      </div>
    </AuthLayout>
  );
};

export default ManagePaymentAccount;
