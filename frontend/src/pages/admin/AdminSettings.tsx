import AdminAvailabilitySettings from "./AdminAvailabilitySettings";
import AdminSecurity from "./AdminSecurity";

const AdminSettings = () => {
  return (
    <div className="space-y-8">
      <AdminAvailabilitySettings />
      <AdminSecurity embedded />
    </div>
  );
};

export default AdminSettings;
