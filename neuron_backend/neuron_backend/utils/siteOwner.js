const { isSiteAdmin, requirePermission } = require('./rbac');

function isSiteOwner(user) {
  return isSiteAdmin(user);
}

const requireSiteOwner = requirePermission('site.admin');

module.exports = { isSiteOwner, requireSiteOwner };
