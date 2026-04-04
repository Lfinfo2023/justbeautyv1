import AdminAvailabilitySettings from "./AdminAvailabilitySettings";
import AdminPaymentSettings from "./AdminPaymentSettings";
import AdminSecurity from "./AdminSecurity";

const AdminSettings = () => {
  return (
    <div className="space-y-8">
      <AdminPaymentSettings />
      <AdminAvailabilitySettings />
      <AdminSecurity embedded />
    </div>
  );
};

export default AdminSettings;
