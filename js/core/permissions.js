// ─── PERMISSION SYSTEM ────────────────────────────────────────────────────
var PERMISSIONS = {
  superadmin: [
    'manage_users','manage_roles','manage_settings','company_settings',
    'rate_add','rate_edit','rate_delete','rate_reset',
    'service_add','service_edit','service_delete',
    'template_add','template_edit','template_delete','template_reset',
    'backup','restore','clear_data','delete_any_record','view_audit',
    'customer_add','customer_edit','customer_delete',
    'quotation_add','quotation_edit',
    'invoice_add','followup_add','daybook_add','bulkmsg_send','view_ratelist'
  ],
  admin: [
    'customer_add','customer_edit','quotation_add','quotation_edit',
    'invoice_add','followup_add','daybook_add','bulkmsg_send',
    'view_ratelist','view_audit','backup'
  ],
  staff: [
    'customer_add','customer_view','followup_add',
    'walkin','view_ratelist','bulkmsg_send'
  ]
};

Auth.currentRole = function() {
  return currentUser ? (currentUser.role || 'staff') : 'staff';
};
Auth.isSuperAdmin = function() {
  // True if logged-in role is superadmin, OR if any admin/superadmin has unlocked the SA gate
  return this.currentRole() === 'superadmin' || this.isSuperAdminUnlocked();
};
Auth.isAdmin = function() {
  var r = this.currentRole(); return r === 'admin' || r === 'superadmin';
};
Auth.can = function(permission) {
  var perms = PERMISSIONS[this.currentRole()] || PERMISSIONS.staff;
  return perms.indexOf(permission) !== -1;
};
Auth.requirePerm = function(permission, action) {
  if (!this.can(permission)) {
    var role = this.currentRole();
    var needed = role === 'staff' ? 'Admin' : 'Super Admin';
    App.toast('\u26d4 \u092f\u094b \u0915\u093e\u092e ' + needed + ' \u0932\u0947 \u092e\u093e\u0924\u094d\u0930 \u0917\u0930\u094d\u0928 \u0938\u0915\u094d\u091b\u0964', 'error', 3000);
    return false;
  }
  if (typeof action === 'function') action();
  return true;
};

