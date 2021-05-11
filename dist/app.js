(function() {
  var f = window.__fuse = window.__fuse || {};
  var modules = f.modules = f.modules || {}; f.dt = function (x) { return x && x.__esModule ? x : { "default": x }; };

  f.bundle = function(collection, fn) {
    for (var num in collection) {
      modules[num] = collection[num];
    }
    fn ? fn() : void 0;
  };
  f.c = {};
  f.r = function(id) {
    var cached = f.c[id];
    if (cached) return cached.m.exports;
    var module = modules[id];
    if (!module) {
      
      throw new Error('Module ' + id + ' was not found');
    }
    cached = f.c[id] = {};
    cached.exports = {};
    cached.m = { exports: cached.exports };
    module(f.r, cached.exports, cached.m);
    return cached.m.exports;
  }; 
})();
__fuse.bundle({

// src/index.ts @1
1: function(__fusereq, exports, module){
exports.__esModule = true;
var v2_account_migrator_1 = __fusereq(2);
var events_1 = __fusereq(3);
var hex_1 = __fusereq(4);
const formEl = document.body.appendChild(document.createElement("form"));
const labelEl = formEl.appendChild(document.createElement("label"));
const labelTextEl = labelEl.appendChild(document.createElement("span"));
labelTextEl.textContent = "Account Handle";
const inputEl = labelEl.appendChild(document.createElement("input"));
const submitEl = formEl.appendChild(document.createElement("button"));
submitEl.textContent = "Migrate";
submitEl.type = "submit";
formEl.addEventListener("submit", e => {
  e.preventDefault();
  inputEl.disabled = true;
  submitEl.disabled = true;
  const accountHandle = hex_1.hexToBytes(inputEl.value);
  if (accountHandle.length == 64) {
    runMigrator(accountHandle);
  }
});
const runMigrator = async accountHandle => {
  const containerEl = document.body.appendChild(document.createElement("div"));
  const statusEl = containerEl.appendChild(document.createElement("h1"));
  const detailsEl = containerEl.appendChild(document.createElement("h2"));
  const migrator = new v2_account_migrator_1.AccountMigrator(accountHandle, {
    storageNodeV1: "https://broker-1.opacitynodes.com:3000",
    storageNodeV2: "https://beta-broker.opacitynodes.com:3000"
  });
  migrator.addEventListener(events_1.MigratorEvents.STATUS, s => {
    console.log("Status:", s.detail.status);
    statusEl.textContent = s.detail.status;
  });
  migrator.addEventListener(events_1.MigratorEvents.DETAILS, d => {
    console.info("Details:", d.detail.details);
    detailsEl.textContent = d.detail.details;
  });
  migrator.addEventListener(events_1.MigratorEvents.WARNING, w => {
    console.warn("Warning:", w.detail.warning);
  });
  await migrator.migrate();
};

},

// ../v2-account-migrator/src/index.ts @2
2: function(__fusereq, exports, module){
var _1_;
var _2_;
var _3_;
exports.__esModule = true;
var path_browserify_1 = __fusereq(5);
var events_1 = __fusereq(3);
var account_1 = __fusereq(6);
var account_management_1 = __fusereq(7);
var account_system_1 = __fusereq(8);
var filesystem_object_1 = __fusereq(9);
var middleware_web_1 = __fusereq(10);
var hex_1 = __fusereq(4);
class AccountMigrator extends EventTarget {
  get status() {
    return this._status;
  }
  get details() {
    return this._details;
  }
  constructor(handle, config) {
    super();
    this._status = "";
    this._details = "";
    this.config = config;
    this.mh = new account_1.MasterHandle({
      handle: hex_1.bytesToHex(handle)
    }, {
      downloadOpts: {
        endpoint: config.storageNodeV1
      },
      uploadOpts: {
        endpoint: config.storageNodeV1
      }
    });
    this.cryptoMiddleware = new middleware_web_1.WebAccountMiddleware({
      asymmetricKey: handle
    });
    this.netMiddleware = new middleware_web_1.WebNetworkMiddleware();
    this.metadataAccess = new account_system_1.MetadataAccess({
      crypto: this.cryptoMiddleware,
      net: this.netMiddleware,
      metadataNode: config.storageNodeV2
    });
    this.account = new account_management_1.Account({
      crypto: this.cryptoMiddleware,
      net: this.netMiddleware,
      storageNode: this.config.storageNodeV2
    });
    this.accountSystem = new account_system_1.AccountSystem({
      metadataAccess: this.metadataAccess
    });
  }
  async migrate() {
    this.setStatus("TESTING: Signing up");
    await this.account.signUp({
      size: 10
    });
    await this.account.waitForPayment();
    this.setStatus("Checking if account is still on v1.");
    this.setDetails("Getting v1 root folder.");
    try {
      const rootFolderV1 = await this.mh.getFolderMeta("/");
      console.log(rootFolderV1);
    } catch (err) {
      this.dispatchEvent(new events_1.MigratorWarningEvent({
        warning: "Account was already migrated, or has never been initialized."
      }));
      return;
    }
    this.setDetails("");
    this.setStatus("Collecting all folders. This may take a while.");
    const allFolders = await this.collectFolderRecursively("/");
    console.log(allFolders);
    this.setDetails("");
    this.setStatus("Collecting all files.");
    const allFiles = allFolders.map(folder => folder[1].files.map(file => [folder[0], file])).flat();
    console.log(allFiles);
    this.setStatus("Migrating folders.");
    try {
      this.setDetails("Initializing v2 root folder.");
      const rootFolderV2 = await this.accountSystem.addFolder("/");
      console.log(rootFolderV2);
    } catch (err) {
      if (err) {
        throw err;
      }
    }
    for (let [path, folderMeta] of allFolders) {
      this.setDetails(`Initializing v2 folder "${path}".`);
      try {
        await this.accountSystem.addFolder(path);
      } catch (err) {
        this.dispatchEvent(new events_1.MigratorWarningEvent({
          warning: "Recieved unknown error: " + err
        }));
      }
    }
    this.setStatus("Migrating files.");
    for (let [path, fileMetadata] of allFiles) {
      for (let version of fileMetadata.versions) {
        this.setDetails(`Initializing file ${version.handle.slice(0, 4)}... ("${fileMetadata.name}") in "${path}".`);
        try {
          try {
            const fileMetadataV2Location = await this.accountSystem.getFileMetadataLocationByFileHandle(hex_1.hexToBytes(version.handle));
            const fileMetadata = await this.accountSystem.getFileMetadata(fileMetadataV2Location);
            if (!fileMetadata.finished) {
              await this.accountSystem.finishUpload(fileMetadataV2Location);
            }
            this.dispatchEvent(new events_1.MigratorWarningEvent({
              warning: "File handle already exists in metadata."
            }));
          } catch (err) {
            if (err instanceof account_system_1.AccountSystemNotFoundError) {
              const fileHandle = hex_1.hexToBytes(version.handle);
              const fileLocation = fileHandle.slice(0, 32);
              const fileEncryptionKey = fileHandle.slice(32, 64);
              const fso = new filesystem_object_1.FileSystemObject({
                handle: fileHandle,
                location: undefined,
                config: {
                  crypto: this.cryptoMiddleware,
                  net: this.netMiddleware,
                  storageNode: this.config.storageNodeV2
                }
              });
              const m = (await fso.exists()) ? await fso.metadata() : undefined;
              const fileMetadataV2 = await this.accountSystem.addUpload(fileLocation, fileEncryptionKey, path, fileMetadata.name, {
                lastModified: ((_1_ = m) === null || _1_ === void 0 ? void 0 : _1_.lastModified) || version.modified || fileMetadata.modified || Date.now(),
                size: ((_2_ = m) === null || _2_ === void 0 ? void 0 : _2_.size) || version.size,
                type: ((_3_ = m) === null || _3_ === void 0 ? void 0 : _3_.type) || ""
              }, false);
              await this.accountSystem.finishUpload(fileMetadataV2.location);
            } else {
              this.dispatchEvent(new events_1.MigratorWarningEvent({
                warning: "Recieved unknown error: " + err
              }));
            }
          }
        } catch (err) {
          this.dispatchEvent(new events_1.MigratorWarningEvent({
            warning: "Recieved unknown error: " + err
          }));
        }
      }
    }
    this.setDetails("");
  }
  async collectFolderRecursively(path, out = []) {
    let output = out.slice();
    this.setDetails(`Getting v1 folder "${path}".`);
    try {
      const fm = await this.mh.getFolderMeta(path);
      output = output.concat([[path, fm]]);
      for (let f of fm.folders) {
        const subPath = path_browserify_1.posix.join(path, f.name);
        output = output.concat(await this.collectFolderRecursively(subPath));
      }
    } catch (err) {
      this.dispatchEvent(new events_1.MigratorWarningEvent({
        warning: err
      }));
    } finally {
      return output;
    }
  }
  setStatus(status) {
    this.dispatchEvent(new events_1.MigratorStatusEvent({
      status
    }));
    this._status = status;
  }
  setDetails(details) {
    this.dispatchEvent(new events_1.MigratorDetailsEvent({
      details: details
    }));
    this._details = details;
  }
}
exports.AccountMigrator = AccountMigrator;

},

// ../v2-account-migrator/src/events.ts @3
3: function(__fusereq, exports, module){
var MigratorEvents;
(function (MigratorEvents) {
  MigratorEvents["STATUS"] = "status";
  MigratorEvents["DETAILS"] = "details";
  MigratorEvents["WARNING"] = "warning";
})(MigratorEvents || (MigratorEvents = {}))
exports.MigratorEvents = MigratorEvents;
class MigratorStatusEvent extends CustomEvent {
  constructor(data) {
    super(MigratorEvents.STATUS, {
      detail: data
    });
  }
}
exports.MigratorStatusEvent = MigratorStatusEvent;
class MigratorDetailsEvent extends CustomEvent {
  constructor(data) {
    super(MigratorEvents.DETAILS, {
      detail: data
    });
  }
}
exports.MigratorDetailsEvent = MigratorDetailsEvent;
class MigratorWarningEvent extends CustomEvent {
  constructor(data) {
    super(MigratorEvents.WARNING, {
      detail: data
    });
  }
}
exports.MigratorWarningEvent = MigratorWarningEvent;

},

// ../v2-account-migrator/ts-client-library/packages/util/src/hex.ts @4
4: function(__fusereq, exports, module){
exports.__esModule = true;
exports.bytesToHex = b => {
  return b.reduce((acc, n) => {
    acc.push(("00" + n.toString(16)).slice(-2));
    return acc;
  }, []).join("");
};
exports.hexToBytes = h => {
  return new Uint8Array((h.match(/.{1,2}/g) || []).map(b => parseInt(b, 16)));
};

},

// ../v2-account-migrator/opaque/src/account.ts @6
6: function(__fusereq, exports, module){
var buffer = __fusereq(17);
var Buffer = buffer;
exports.__esModule = true;
var bip39_1 = __fusereq(18);
var hdkey_1 = __fusereq(19);
var hdkey_1d = __fuse.dt(hdkey_1);
var eth_ens_namehash_1 = __fusereq(25);
var hashToPath_1 = __fusereq(26);
var index_1 = __fusereq(27);
class Account {
  get mnemonic() {
    return this._mnemonic.trim().split(/\s+/g);
  }
  constructor(mnemonic = bip39_1.generateMnemonic()) {
    if (!bip39_1.validateMnemonic(mnemonic)) {
      throw new Error("mnemonic provided was not valid");
    }
    this._mnemonic = mnemonic;
  }
  get seed() {
    return bip39_1.mnemonicToSeedSync(this._mnemonic);
  }
}
class MasterHandle extends hdkey_1d.default {
  constructor({account, handle}, {uploadOpts = {}, downloadOpts = {}} = {}) {
    super();
    this.metaQueue = {};
    this.metaFolderCreating = {};
    this.generateSubHDKey = pathString => index_1.generateSubHDKey(this, pathString);
    this.uploadFile = (dir, file) => index_1.uploadFile(this, dir, file);
    this.downloadFile = handle => index_1.downloadFile(this, handle);
    this.deleteFile = (dir, file) => index_1.deleteFile(this, dir, file);
    this.deleteVersion = (dir, version) => index_1.deleteVersion(this, dir, version);
    this.getFolderHDKey = dir => index_1.getFolderHDKey(this, dir);
    this.getFolderLocation = dir => index_1.getFolderLocation(this, dir);
    this.createFolderMeta = async dir => index_1.createFolderMeta(this, dir);
    this.createFolder = async (dir, name) => index_1.createFolder(this, dir, name);
    this.deleteFolderMeta = async dir => index_1.deleteFolderMeta(this, dir);
    this.deleteFolder = async (dir, folder) => index_1.deleteFolder(this, dir, folder);
    this.moveFile = async (dir, {file, to}) => index_1.moveFile(this, dir, {
      file,
      to
    });
    this.moveFolder = async (dir, {folder, to}) => index_1.moveFolder(this, dir, {
      folder,
      to
    });
    this.renameFile = async (dir, {file, name}) => index_1.renameFile(this, dir, {
      file,
      name
    });
    this.renameFolder = async (dir, {folder, name}) => index_1.renameFolder(this, dir, {
      folder,
      name
    });
    this.setFolderMeta = async (dir, folderMeta) => index_1.setFolderMeta(this, dir, folderMeta);
    this.getFolderMeta = async dir => index_1.getFolderMeta(this, dir);
    this.buildFullTree = async dir => index_1.buildFullTree(this, dir);
    this.getAccountInfo = async () => index_1.getAccountInfo(this);
    this.isExpired = async () => index_1.isExpired(this);
    this.isPaid = async () => index_1.isPaid(this);
    this.login = async () => index_1.login(this);
    this.register = async (duration, limit) => index_1.register(this, duration, limit);
    this.upgrade = async (duration, limit) => index_1.upgradeAccount(this, duration, limit);
    this.renew = async duration => index_1.renewAccount(this, duration);
    this.uploadOpts = uploadOpts;
    this.downloadOpts = downloadOpts;
    if (account && account.constructor == Account) {
      const path = "m/43'/60'/1775'/0'/" + hashToPath_1.hashToPath(eth_ens_namehash_1.hash("opacity.io").replace(/^0x/, ""));
      Object.assign(this, hdkey_1.fromMasterSeed(account.seed).derive(path));
    } else if (handle && handle.constructor == String) {
      this.privateKey = Buffer.from(handle.slice(0, 64), "hex");
      this.chainCode = Buffer.from(handle.slice(64), "hex");
    } else {
      throw new Error("master handle was not of expected type");
    }
  }
  get handle() {
    return index_1.getHandle(this);
  }
}
exports.HDKey = hdkey_1d.default;
exports.Account = Account;
exports.MasterHandle = MasterHandle;

},

// ../v2-account-migrator/ts-client-library/packages/account-management/src/index.ts @7
7: function(__fusereq, exports, module){
exports.__esModule = true;
var promise_1 = __fusereq(12);
var payload_1 = __fusereq(13);
var hex_1 = __fusereq(4);
var b64_1 = __fusereq(14);
var AccountPaymentStatus;
(function (AccountPaymentStatus) {
  AccountPaymentStatus["UNPAID"] = "unpaid";
  AccountPaymentStatus["PENDING"] = "pending";
  AccountPaymentStatus["PAID"] = "paid";
  AccountPaymentStatus["EXPIRED"] = "expired";
})(AccountPaymentStatus || (AccountPaymentStatus = {}))
exports.AccountPaymentStatus = AccountPaymentStatus;
var AccountRenewStatus;
(function (AccountRenewStatus) {
  AccountRenewStatus["INCOMPLETE"] = "Incomplete";
  AccountRenewStatus["PAID"] = "Success with OPCT";
})(AccountRenewStatus || (AccountRenewStatus = {}))
exports.AccountRenewStatus = AccountRenewStatus;
var AccountUpgradeStatus;
(function (AccountUpgradeStatus) {
  AccountUpgradeStatus["INCOMPLETE"] = "Incomplete";
  AccountUpgradeStatus["PAID"] = "Success with OPCT";
})(AccountUpgradeStatus || (AccountUpgradeStatus = {}))
exports.AccountUpgradeStatus = AccountUpgradeStatus;
class Account {
  constructor(config) {
    this.config = config;
  }
  async info() {
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {}
    });
    const res = await this.config.net.POST(this.config.storageNode + "/api/v1/account-data", undefined, JSON.stringify(payload), body => new Response(body).json());
    if (!res.ok) {
      throw new Error("Error getting account information: " + JSON.stringify(res.data));
    }
    return res.data;
  }
  async createSubscription({stripeToken = ""} = {}) {
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {
        stripeToken
      }
    });
    const res = await this.config.net.POST(this.config.storageNode + "/api/v1/stripe/create", undefined, JSON.stringify(payload), body => new Response(body).json());
    if (!res.ok) {
      throw new Error("Error getting Stripe information: " + JSON.stringify(res.data));
    }
    return res.data;
  }
  async plans() {
    const res = await this.config.net.GET(this.config.storageNode + "/plans", undefined, undefined, body => new Response(body).json());
    const plans = Object.values(res.data.plans).filter(plan => plan.storageInGB <= 2048);
    return plans;
  }
  async status() {
    const info = await this.info();
    return info.paymentStatus;
  }
  async signUp({size = 128, duration = 12} = {}) {
    try {
      const info = await this.info();
      if (info.invoice) {
        return info.invoice;
      }
      if (info.paymentStatus == AccountPaymentStatus.PAID) {
        return {
          cost: 0,
          ethAddress: ""
        };
      }
    } catch {}
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {
        durationInMonths: duration,
        storageLimit: size
      }
    });
    const res = await this.config.net.POST(this.config.storageNode + "/api/v1/accounts", undefined, JSON.stringify(payload), body => new Response(body).json());
    if (!res.ok || !res.data.invoice) {
      throw new Error("Error getting invoice");
    }
    return res.data.invoice;
  }
  async waitForPayment() {
    const [done, resolveDone] = promise_1.extractPromise();
    let iTime = 2;
    const iFn = async () => {
      const status = await this.status();
      if (status == AccountPaymentStatus.PAID) {
        resolveDone();
      } else {
        iTime *= 2;
        if (iTime > 10) {
          iTime = 10;
        }
        setTimeout(iFn, iTime * 1000);
      }
    };
    setTimeout(iFn, iTime);
    await done;
  }
  async renewStatus({fileIDs, metadataKeys}) {
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {
        fileHandles: fileIDs.map(id => hex_1.bytesToHex(id)),
        metadataKeys: metadataKeys.map(key => b64_1.bytesToB64URL(key))
      }
    });
    const res = await this.config.net.POST(this.config.storageNode + "/api/v2/renew", undefined, JSON.stringify(payload), body => new Response(body).json());
    if (!res.ok || !res.data.status) {
      throw new Error("Error getting renewal status");
    }
    return res.data.status;
  }
  async renewAccount({duration = 12}) {
    try {
      const info = await this.info();
      if (info.invoice) {
        return info.invoice;
      }
    } catch {}
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {
        durationInMonths: duration
      }
    });
    const res = await this.config.net.POST(this.config.storageNode + "/api/v2/renew/invoice", undefined, JSON.stringify(payload), body => new Response(body).json());
    if (!res.ok || !res.data.opctInvoice) {
      throw new Error("Error getting renewal invoice");
    }
    return res.data.opctInvoice;
  }
  async waitForRenewPayment(renewStatusArgs) {
    const [done, resolveDone] = promise_1.extractPromise();
    let iTime = 2;
    const iFn = async () => {
      const status = await this.renewStatus(renewStatusArgs);
      if (status == AccountRenewStatus.PAID) {
        resolveDone();
      } else {
        iTime *= 2;
        if (iTime > 10) {
          iTime = 10;
        }
        setTimeout(iFn, iTime * 1000);
      }
    };
    setTimeout(iFn, iTime);
    await done;
  }
  async upgradeStatus({fileIDs, metadataKeys}) {
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {
        fileHandles: fileIDs.map(id => hex_1.bytesToHex(id)),
        metadataKeys: metadataKeys.map(key => b64_1.bytesToB64URL(key))
      }
    });
    const res = await this.config.net.POST(this.config.storageNode + "/api/v2/upgrade", undefined, JSON.stringify(payload), body => new Response(body).json());
    if (!res.ok || !res.data.status) {
      throw new Error("Error getting upgrade status");
    }
    return res.data.status;
  }
  async upgradeAccount({size, duration = 12}) {
    try {
      const info = await this.info();
      if (info.invoice) {
        return info.invoice;
      }
    } catch {}
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {
        storageLimit: size,
        durationInMonths: duration
      }
    });
    const res = await this.config.net.POST(this.config.storageNode + "/api/v2/upgrade/invoice", undefined, JSON.stringify(payload), body => new Response(body).json());
    if (!res.ok || !res.data.opctInvoice) {
      throw new Error("Error getting upgrade invoice");
    }
    return res.data.opctInvoice;
  }
  async waitForUpgradePayment(UpgradeStatusArgs) {
    const [done, resolveDone] = promise_1.extractPromise();
    let iTime = 2;
    const iFn = async () => {
      const status = await this.upgradeStatus(UpgradeStatusArgs);
      if (status == AccountUpgradeStatus.PAID) {
        resolveDone();
      } else {
        iTime *= 2;
        if (iTime > 10) {
          iTime = 10;
        }
        setTimeout(iFn, iTime * 1000);
      }
    };
    setTimeout(iFn, iTime);
    await done;
  }
}
exports.Account = Account;

},

// ../v2-account-migrator/ts-client-library/packages/account-system/src/index.ts @8
8: function(__fusereq, exports, module){
exports.__esModule = true;
var AccountSystem_1 = __fusereq(15);
exports.AccountSystem = AccountSystem_1.AccountSystem;
exports.AccountSystemAlreadyExistsError = AccountSystem_1.AccountSystemAlreadyExistsError;
exports.AccountSystemConfig = AccountSystem_1.AccountSystemConfig;
exports.AccountSystemLengthError = AccountSystem_1.AccountSystemLengthError;
exports.AccountSystemNotEmptyError = AccountSystem_1.AccountSystemNotEmptyError;
exports.AccountSystemNotFoundError = AccountSystem_1.AccountSystemNotFoundError;
exports.AccountSystemSanitizationError = AccountSystem_1.AccountSystemSanitizationError;
exports.FileCreationMetadata = AccountSystem_1.FileCreationMetadata;
exports.FileMetadata = AccountSystem_1.FileMetadata;
exports.FilesIndex = AccountSystem_1.FilesIndex;
exports.FilesIndexEntry = AccountSystem_1.FilesIndexEntry;
exports.FolderFileEntry = AccountSystem_1.FolderFileEntry;
exports.FolderMetadata = AccountSystem_1.FolderMetadata;
exports.FoldersIndex = AccountSystem_1.FoldersIndex;
exports.FoldersIndexEntry = AccountSystem_1.FoldersIndexEntry;
exports.ShareFileMetadata = AccountSystem_1.ShareFileMetadata;
exports.ShareFileMetadataInit = AccountSystem_1.ShareFileMetadataInit;
exports.ShareIndex = AccountSystem_1.ShareIndex;
exports.ShareIndexEntry = AccountSystem_1.ShareIndexEntry;
exports.ShareMetadata = AccountSystem_1.ShareMetadata;
var MetadataAccess_1 = __fusereq(16);
exports.MetadataAccess = MetadataAccess_1.MetadataAccess;
exports.MetadataAccessConfig = MetadataAccess_1.MetadataAccessConfig;

},

// ../v2-account-migrator/ts-client-library/packages/filesystem-access/src/filesystem-object.ts @9
9: function(__fusereq, exports, module){
exports.__esModule = true;
var hex_1 = __fusereq(4);
var events_1 = __fusereq(30);
var payload_1 = __fusereq(13);
var serializeEncrypted_1 = __fusereq(31);
class FileSystemObjectDeletionError extends Error {
  constructor(location, err) {
    super(`DeletionError: Failed to delete "${location}". Error: "${err}"`);
  }
}
exports.FileSystemObjectDeletionError = FileSystemObjectDeletionError;
class FileSystemObject extends EventTarget {
  get handle() {
    return this._handle;
  }
  get location() {
    return this._location;
  }
  get public() {
    return !!this._location;
  }
  get private() {
    return !!this._handle;
  }
  constructor({handle, location, config}) {
    super();
    this._handle = handle;
    this._location = location;
    this.config = config;
  }
  async _getDownloadURL(fileID) {
    const res = await this.config.net.POST(this.config.storageNode + "/api/v1/download", undefined, JSON.stringify({
      fileID: hex_1.bytesToHex(fileID)
    }), b => new Response(b).text());
    return res;
  }
  async exists() {
    if (!this._handle && !this._location) {
      console.warn("filesystem object already deleted");
      return false;
    }
    if (this._handle) {
      const fileID = this._handle.slice(0, 32);
      const res = await this._getDownloadURL(fileID);
      if (res.status == 200) {
        return true;
      }
    }
    if (this._location) {
      const fileID = this._location.slice(0, 32);
      const res = await this._getDownloadURL(fileID);
      if (res.status == 200) {
        return true;
      }
    }
    return false;
  }
  async metadata() {
    if (!this._handle && !this._location) {
      console.warn("filesystem object already deleted");
      return;
    }
    const fileID = this._location ? this._location.slice(0, 32) : this._handle.slice(0, 32);
    const downloadURL = await this._getDownloadURL(fileID);
    const res = await this.config.net.GET(downloadURL + "/metadata", undefined, undefined, async rs => new Uint8Array(await new Response(rs).arrayBuffer()));
    if (!res.ok) {
      return;
    }
    if (this._handle) {
      return serializeEncrypted_1.serializeEncrypted(this.config.crypto, res.data, this._handle.slice(32, 64));
    }
    if (this._location) {
      return JSON.parse(new TextDecoder().decode(res.data));
    }
  }
  async delete() {
    if (!this._handle && !this._location) {
      console.warn("filesystem object already deleted");
      return;
    }
    if (this._beforeDelete) {
      await this._beforeDelete(this);
    }
    if (this._handle) {
      this.dispatchEvent(new events_1.FileSystemObjectDeleteEvent({}));
      const fileID = this._handle.slice(0, 32);
      const payload = await payload_1.getPayload({
        crypto: this.config.crypto,
        payload: {
          fileID: hex_1.bytesToHex(fileID)
        }
      });
      const res = await this.config.net.POST(this.config.storageNode + "/api/v1/delete", undefined, JSON.stringify(payload), b => new Response(b).text());
      if (res.status != 200) {
        throw new FileSystemObjectDeletionError(hex_1.bytesToHex(fileID), res.data);
      }
      if (this._afterDelete) {
        await this._afterDelete(this);
      }
      delete this._handle;
    }
    if (this._location) {
      this.dispatchEvent(new events_1.FileSystemObjectDeleteEvent({}));
      const fileID = this._location.slice(0, 32);
      const payload = await payload_1.getPayload({
        crypto: this.config.crypto,
        payload: {
          fileID: hex_1.bytesToHex(fileID)
        }
      });
      const res = await this.config.net.POST(this.config.storageNode + "/api/v1/delete", undefined, JSON.stringify(payload), b => new Response(b).text());
      if (res.status != 200) {
        throw new FileSystemObjectDeletionError(hex_1.bytesToHex(fileID), res.data);
      }
      if (this._afterDelete) {
        await this._afterDelete(this);
      }
      delete this._location;
    }
  }
}
exports.FileSystemObject = FileSystemObject;

},

// ../v2-account-migrator/ts-client-library/packages/middleware-web/src/index.ts @10
10: function(__fusereq, exports, module){
exports.__esModule = true;
var webAccountMiddleware_1 = __fusereq(28);
exports.WebAccountMiddleware = webAccountMiddleware_1.WebAccountMiddleware;
exports.WebAccountMiddlewareArgs = webAccountMiddleware_1.WebAccountMiddlewareArgs;
var webNetworkMiddleware_1 = __fusereq(29);
exports.WebNetworkMiddleware = webNetworkMiddleware_1.WebNetworkMiddleware;

},

// ../v2-account-migrator/ts-client-library/packages/util/src/promise.ts @12
12: function(__fusereq, exports, module){
exports.__esModule = true;
exports.extractPromise = () => {
  let rs, rj;
  const promise = new Promise((resole, reject) => {
    rs = resole;
    rj = reject;
  });
  return [promise, rs, rj];
};

},

// ../v2-account-migrator/ts-client-library/packages/util/src/payload.ts @13
13: function(__fusereq, exports, module){
exports.__esModule = true;
var js_sha3_1 = __fusereq(32);
var hex_1 = __fusereq(4);
exports.getPayload = async ({crypto, payload: rawPayload, key, payloadKey = "requestBody"}) => {
  Object.assign(rawPayload, {
    timestamp: Math.floor(Date.now() / 1000)
  });
  const payload = JSON.stringify(rawPayload);
  const hash = new Uint8Array(js_sha3_1.keccak256.arrayBuffer(payload));
  const signature = await crypto.sign(key, hash);
  const pubKey = await crypto.getPublicKey(key);
  const data = {
    [payloadKey]: payload,
    signature: hex_1.bytesToHex(signature),
    publicKey: hex_1.bytesToHex(pubKey),
    hash: hex_1.bytesToHex(hash)
  };
  return data;
};
exports.getPayloadFD = async ({crypto, payload: rawPayload, extraPayload, key, payloadKey = "requestBody"}) => {
  Object.assign(rawPayload, {
    timestamp: Math.floor(Date.now() / 1000)
  });
  const payload = JSON.stringify(rawPayload);
  const hash = new Uint8Array(js_sha3_1.keccak256.arrayBuffer(payload));
  const signature = await crypto.sign(key, hash);
  const pubKey = await crypto.getPublicKey(key);
  const data = new FormData();
  data.append(payloadKey, payload);
  data.append("signature", hex_1.bytesToHex(signature));
  data.append("publicKey", hex_1.bytesToHex(pubKey));
  data.append("hash", hex_1.bytesToHex(hash));
  if (extraPayload) {
    Object.keys(extraPayload).forEach(key => {
      data.append(key, new Blob([extraPayload[key].buffer]), key);
    });
  }
  return data;
};

},

// ../v2-account-migrator/ts-client-library/packages/util/src/b64.ts @14
14: function(__fusereq, exports, module){
exports.__esModule = true;
var js_base64_1 = __fusereq(33);
exports.bytesToB64URL = b => {
  return js_base64_1.fromUint8Array(b, true).padEnd(Math.ceil(b.length / 3) * 4, "=");
};
exports.b64URLToBytes = b64 => {
  return js_base64_1.toUint8Array(b64);
};

},

// ../v2-account-migrator/ts-client-library/packages/account-system/src/AccountSystem.ts @15
15: function(__fusereq, exports, module){
var _1_, _2_;
var _3_, _4_;
var _5_, _6_;
var _7_, _8_;
var _9_, _10_;
var _11_, _12_;
var _13_, _14_;
var _15_, _16_;
var _17_, _18_;
var _19_, _20_;
var _21_, _22_;
var _23_, _24_;
var _25_, _26_;
var _27_, _28_;
exports.__esModule = true;
var async_mutex_1 = __fusereq(34);
var path_browserify_1 = __fusereq(35);
var automerge_1 = __fusereq(36);
var automerge_1d = __fuse.dt(automerge_1);
var arrayEquality_1 = __fusereq(37);
var b64_1 = __fusereq(14);
var hex_1 = __fusereq(4);
var path_1 = __fusereq(38);
var mnemonic_1 = __fusereq(39);
var arrayMerge_1 = __fusereq(40);
class AccountSystemLengthError extends Error {
  constructor(item, min, max, recieved) {
    super(`AccountSystemLengthError: Invalid length of "${item}". Expected between ${min} and ${max}. Got ${recieved}`);
  }
}
exports.AccountSystemLengthError = AccountSystemLengthError;
class AccountSystemAlreadyExistsError extends Error {
  constructor(type, path) {
    super(`AccountSystemAlreadyExistsError: ${type} "${path}" already exists`);
  }
}
exports.AccountSystemAlreadyExistsError = AccountSystemAlreadyExistsError;
class AccountSystemSanitizationError extends Error {
  constructor(type, path, illegal) {
    super(`AccountSystemSanitizationError: ${type} "${path}" includes illegal characters "${illegal.map(s => `"${s}"`).join(", ")}"`);
  }
}
exports.AccountSystemSanitizationError = AccountSystemSanitizationError;
class AccountSystemNotFoundError extends Error {
  constructor(type, path) {
    super(`AccountSystemNotFoundError: ${type} "${path}" not found`);
  }
}
exports.AccountSystemNotFoundError = AccountSystemNotFoundError;
class AccountSystemNotEmptyError extends Error {
  constructor(type, path, action) {
    super(`AccountSystemNotEmptyError: ${type} "${path}" must be empty to ${action}`);
  }
}
exports.AccountSystemNotEmptyError = AccountSystemNotEmptyError;
const validateFilename = name => {
  if (name.length < 1 || name.length > 255) {
    throw new AccountSystemLengthError(`filename ("${name}")`, 1, 255, name.length);
  }
  if (name.includes(path_browserify_1.posix.sep) || name.includes("\0")) {
    throw new AccountSystemSanitizationError("file", name, [path_browserify_1.posix.sep, "\0"]);
  }
};
const validateDirectoryPath = path => {
  if (path == "/") {
    return;
  }
  for (let dir of path.split(path_browserify_1.posix.sep).slice(1)) {
    try {
      validateFilename(dir);
    } catch (err) {
      if (err instanceof AccountSystemLengthError) {
        throw new AccountSystemLengthError(`directory ("${dir}" of "${path}")`, 1, 255, dir.length);
      } else if (err instanceof AccountSystemSanitizationError) {
        throw new AccountSystemSanitizationError("directory", dir, [path_browserify_1.posix.sep, "\0"]);
      } else {
        throw err;
      }
    }
  }
};
const unfreezeUint8Array = arr => {
  return new Uint8Array(Object.values(arr));
};
class AccountSystem {
  constructor(config) {
    this.guid = "5b7c0640-bc3a-4fa8-b588-ca6a922c1475";
    this.version = 2;
    this.prefix = "/" + this.guid + "/v" + this.version;
    this.indexes = {
      files: this.prefix + "/files",
      folders: this.prefix + "/folders",
      share: this.prefix + "/share"
    };
    this._m = new async_mutex_1.Mutex();
    this.config = config;
  }
  getFileDerivePath(location) {
    return this.prefix + "/file/" + b64_1.bytesToB64URL(location);
  }
  async getFilesIndex(markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFilesIndex(markCacheDirty));
  }
  async _getFilesIndex(markCacheDirty = false) {
    const filesIndex = (await this.config.metadataAccess.get(this.indexes.files, markCacheDirty)) || automerge_1d.default.from({
      files: []
    });
    return {
      files: filesIndex.files.map(file => ({
        location: unfreezeUint8Array(file.location),
        finished: !!file.finished,
        private: {
          handle: ((_2_ = (_1_ = file) === null || _1_ === void 0 ? void 0 : _1_.private) === null || _2_ === void 0 ? void 0 : _2_.handle) ? unfreezeUint8Array(file.private.handle) : null
        },
        public: {
          location: ((_4_ = (_3_ = file) === null || _3_ === void 0 ? void 0 : _3_.public) === null || _4_ === void 0 ? void 0 : _4_.location) ? unfreezeUint8Array(file.public.location) : null
        },
        deleted: !!file.deleted,
        errored: false
      }))
    };
  }
  async getFileMetadataLocationByFileHandle(fileHandle, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFileMetadataLocationByFileHandle(fileHandle, markCacheDirty));
  }
  async _getFileMetadataLocationByFileHandle(fileHandle, markCacheDirty = false) {
    const filesIndex = await this._getFilesIndex(markCacheDirty);
    const fileEntry = filesIndex.files.find(file => file.private.handle && arrayEquality_1.arraysEqual(file.private.handle, fileHandle));
    if (!fileEntry) {
      throw new AccountSystemNotFoundError("file of handle", hex_1.bytesToHex(fileHandle.slice(0, 32)) + "...");
    }
    return fileEntry.location;
  }
  async getFileMetadataLocationByFileLocation(fileLocation, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFileMetadataLocationByFileHandle(fileLocation, markCacheDirty));
  }
  async _getFileMetadataLocationByFileLocation(fileLocation, markCacheDirty = false) {
    const filesIndex = await this._getFilesIndex(markCacheDirty);
    const fileEntry = filesIndex.files.find(file => file.public.location && arrayEquality_1.arraysEqual(file.public.location, fileLocation));
    if (!fileEntry) {
      throw new AccountSystemNotFoundError("file of handle", hex_1.bytesToHex(fileLocation.slice(0, 32)) + "...");
    }
    return fileEntry.location;
  }
  async getFileIndexEntryByFileMetadataLocation(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFileIndexEntryByFileMetadataLocation(location, markCacheDirty));
  }
  async _getFileIndexEntryByFileMetadataLocation(location, markCacheDirty = false) {
    const filesIndex = await this._getFilesIndex(markCacheDirty);
    const fileEntry = filesIndex.files.find(file => arrayEquality_1.arraysEqual(file.location, location));
    if (!fileEntry) {
      throw new AccountSystemNotFoundError("file", b64_1.bytesToB64URL(location));
    }
    return {
      location: fileEntry.location,
      finished: !!fileEntry.finished,
      private: {
        handle: fileEntry.private.handle
      },
      public: {
        location: fileEntry.public.location
      },
      deleted: !!fileEntry.deleted,
      errored: !!fileEntry.errored
    };
  }
  async getFileMetadata(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFileMetadata(location, markCacheDirty));
  }
  async _getFileMetadata(location, markCacheDirty = false) {
    const filePath = this.getFileDerivePath(location);
    const doc = await this.config.metadataAccess.get(filePath, markCacheDirty);
    if (!doc) {
      throw new AccountSystemNotFoundError("file", filePath);
    }
    return {
      location: unfreezeUint8Array(doc.location),
      name: doc.name,
      folderDerive: unfreezeUint8Array(doc.folderDerive),
      size: doc.size,
      uploaded: doc.uploaded,
      modified: doc.modified,
      type: doc.type,
      finished: !!doc.finished,
      private: {
        handle: ((_6_ = (_5_ = doc) === null || _5_ === void 0 ? void 0 : _5_.private) === null || _6_ === void 0 ? void 0 : _6_.handle) ? unfreezeUint8Array(doc.private.handle) : null
      },
      public: {
        location: ((_8_ = (_7_ = doc) === null || _7_ === void 0 ? void 0 : _7_.public) === null || _8_ === void 0 ? void 0 : _8_.location) ? unfreezeUint8Array(doc.public.location) : null,
        shortLinks: doc.public.shortLinks.map(s => unfreezeUint8Array(s))
      }
    };
  }
  async addUpload(fileLocation, fileEncryptionKey, path, filename, meta, pub, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._addUpload(fileLocation, fileEncryptionKey, path, filename, meta, pub, markCacheDirty));
  }
  async _addUpload(fileLocation, fileEncryptionKey, path, filename, meta, pub, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    validateDirectoryPath(path);
    validateFilename(filename);
    const folder = await this._addFolder(path, markCacheDirty);
    const folderDerive = folder.location;
    const metaLocation = await this.config.metadataAccess.config.crypto.getRandomValues(32);
    const filePath = this.getFileDerivePath(metaLocation);
    const fileHandle = fileEncryptionKey ? arrayMerge_1.arrayMerge(fileLocation, fileEncryptionKey) : fileLocation;
    await this.config.metadataAccess.change(this.indexes.files, `Add file "${b64_1.bytesToB64URL(metaLocation)}" to file index`, doc => {
      if (!doc.files) {
        doc.files = [];
      }
      doc.files.push({
        location: metaLocation,
        finished: false,
        private: {
          handle: pub ? null : fileHandle
        },
        public: {
          location: pub ? fileLocation : null
        },
        deleted: false,
        errored: false
      });
    }, markCacheDirty);
    const file = await this.config.metadataAccess.change(filePath, `Init file metadata for "${b64_1.bytesToB64URL(metaLocation)}"`, doc => {
      doc.location = metaLocation;
      doc.name = filename;
      doc.folderDerive = folderDerive;
      doc.modified = meta.lastModified;
      doc.size = meta.size;
      doc.type = meta.type;
      doc.uploaded = Date.now();
      doc.finished = false;
      doc.private = {
        handle: pub ? null : fileHandle
      };
      doc.public = {
        location: pub ? fileLocation : null,
        shortLinks: []
      };
    }, markCacheDirty);
    return {
      location: unfreezeUint8Array(file.location),
      name: file.name,
      folderDerive: unfreezeUint8Array(file.folderDerive),
      size: file.size,
      uploaded: file.uploaded,
      modified: file.modified,
      type: file.type,
      finished: !!file.finished,
      private: {
        handle: ((_10_ = (_9_ = file) === null || _9_ === void 0 ? void 0 : _9_.private) === null || _10_ === void 0 ? void 0 : _10_.handle) ? unfreezeUint8Array(file.private.handle) : null
      },
      public: {
        location: ((_12_ = (_11_ = file) === null || _11_ === void 0 ? void 0 : _11_.public) === null || _12_ === void 0 ? void 0 : _12_.location) ? unfreezeUint8Array(file.public.location) : null,
        shortLinks: file.public.shortLinks.map(s => unfreezeUint8Array(s))
      }
    };
  }
  async finishUpload(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._finishUpload(location, markCacheDirty));
  }
  async _finishUpload(location, markCacheDirty = false) {
    const fileMeta = await this.config.metadataAccess.change(this.getFileDerivePath(location), "Mark upload finished", doc => {
      doc.finished = true;
    }, markCacheDirty);
    await this.config.metadataAccess.change(this.getFolderDerivePath(unfreezeUint8Array(fileMeta.folderDerive)), `Add file "${b64_1.bytesToB64URL(location)}" to folder`, doc => {
      if (!doc.files) {
        doc.files = [];
      }
      doc.files.push({
        name: fileMeta.name,
        location: location
      });
      doc.modified = Date.now();
      doc.size++;
    }, markCacheDirty);
    await this.config.metadataAccess.change(this.indexes.files, `Mark upload ${b64_1.bytesToB64URL(location)} finished`, doc => {
      const fileEntry = doc.files.find(file => arrayEquality_1.arraysEqual(location, file.location));
      if (!fileEntry) {
        throw new AccountSystemNotFoundError("file entry", `"${b64_1.bytesToB64URL(location)}" in "${b64_1.bytesToB64URL(unfreezeUint8Array(fileMeta.folderDerive))}"`);
      }
      fileEntry.finished = true;
    }, markCacheDirty);
  }
  async renameFile(location, newName, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._renameFile(location, newName, markCacheDirty));
  }
  async _renameFile(location, newName, markCacheDirty = false) {
    validateFilename(newName);
    const fileIndexEntry = await this._getFileIndexEntryByFileMetadataLocation(location, markCacheDirty);
    if (!fileIndexEntry) {
      throw new AccountSystemNotFoundError("file", b64_1.bytesToB64URL(location));
    }
    const fileMeta = await this.config.metadataAccess.change(this.getFileDerivePath(fileIndexEntry.location), "Rename file", doc => {
      doc.name = newName;
    }, markCacheDirty);
    await this.config.metadataAccess.change(this.getFolderDerivePath(unfreezeUint8Array(fileMeta.folderDerive)), `Rename file ${b64_1.bytesToB64URL(location)}`, doc => {
      const fileEntry = doc.files.find(file => arrayEquality_1.arraysEqual(location, file.location));
      if (!fileEntry) {
        throw new AccountSystemNotFoundError("file entry", `"${b64_1.bytesToB64URL(location)}" in "${b64_1.bytesToB64URL(unfreezeUint8Array(fileMeta.folderDerive))}"`);
      }
      fileEntry.name = newName;
    }, markCacheDirty);
    return {
      location: unfreezeUint8Array(fileMeta.location),
      name: fileMeta.name,
      folderDerive: unfreezeUint8Array(fileMeta.folderDerive),
      size: fileMeta.size,
      uploaded: fileMeta.uploaded,
      modified: fileMeta.modified,
      type: fileMeta.type,
      finished: !!fileMeta.finished,
      private: {
        handle: ((_14_ = (_13_ = fileMeta) === null || _13_ === void 0 ? void 0 : _13_.private) === null || _14_ === void 0 ? void 0 : _14_.handle) ? unfreezeUint8Array(fileMeta.private.handle) : null
      },
      public: {
        location: ((_16_ = (_15_ = fileMeta) === null || _15_ === void 0 ? void 0 : _15_.public) === null || _16_ === void 0 ? void 0 : _16_.location) ? unfreezeUint8Array(fileMeta.public.location) : null,
        shortLinks: fileMeta.public.shortLinks.map(s => unfreezeUint8Array(s))
      }
    };
  }
  async moveFile(location, newPath, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._moveFile(location, newPath, markCacheDirty));
  }
  async _moveFile(location, newPath, markCacheDirty = false) {
    newPath = path_1.cleanPath(newPath);
    validateDirectoryPath(newPath);
    const folder = await this._addFolder(newPath, markCacheDirty);
    const folderDerive = folder.location;
    const oldFileMeta = await this._getFileMetadata(location, markCacheDirty);
    const newFolder = await this._addFolder(newPath, markCacheDirty);
    await this.config.metadataAccess.change(this.getFolderDerivePath(newFolder.location), `Move file ${b64_1.bytesToB64URL(location)}`, doc => {
      doc.files.push({
        location,
        name: oldFileMeta.name
      });
      doc.modified = Date.now();
      doc.size++;
    }, markCacheDirty);
    await this.config.metadataAccess.change(this.getFolderDerivePath(oldFileMeta.folderDerive), `Move file ${b64_1.bytesToB64URL(location)}`, doc => {
      const fileEntryIndex = doc.files.findIndex(file => arrayEquality_1.arraysEqual(location, file.location));
      if (fileEntryIndex == -1) {
        throw new AccountSystemNotFoundError("file entry", `"${b64_1.bytesToB64URL(location)}" in "${b64_1.bytesToB64URL(oldFileMeta.folderDerive)}"`);
      }
      doc.files.splice(fileEntryIndex, 1);
      doc.modified = Date.now();
      doc.size--;
    }, markCacheDirty);
    const newFileMeta = await this.config.metadataAccess.change(this.getFileDerivePath(location), "Move file", doc => {
      doc.folderDerive = folderDerive;
    }, markCacheDirty);
    return {
      location: unfreezeUint8Array(newFileMeta.location),
      name: newFileMeta.name,
      folderDerive: unfreezeUint8Array(newFileMeta.folderDerive),
      size: newFileMeta.size,
      uploaded: newFileMeta.uploaded,
      modified: newFileMeta.modified,
      type: newFileMeta.type,
      finished: !!newFileMeta.finished,
      private: {
        handle: ((_18_ = (_17_ = newFileMeta) === null || _17_ === void 0 ? void 0 : _17_.private) === null || _18_ === void 0 ? void 0 : _18_.handle) ? unfreezeUint8Array(newFileMeta.private.handle) : null
      },
      public: {
        location: ((_20_ = (_19_ = newFileMeta) === null || _19_ === void 0 ? void 0 : _19_.public) === null || _20_ === void 0 ? void 0 : _20_.location) ? unfreezeUint8Array(newFileMeta.public.location) : null,
        shortLinks: newFileMeta.public.shortLinks.map(s => unfreezeUint8Array(s))
      }
    };
  }
  async removeFile(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._removeFile(location, markCacheDirty));
  }
  async _removeFile(location, markCacheDirty = false) {
    await this.config.metadataAccess.change(this.indexes.files, "Mark upload deleted", doc => {
      const fileEntry = doc.files.find(file => arrayEquality_1.arraysEqual(unfreezeUint8Array(file.location), location));
      if (!fileEntry) {
        throw new AccountSystemNotFoundError("file entry", b64_1.bytesToB64URL(location));
      }
      fileEntry.deleted = true;
    }, markCacheDirty);
    const fileMeta = await this._getFileMetadata(location, markCacheDirty);
    await this.config.metadataAccess.delete(this.getFileDerivePath(location));
    await this.config.metadataAccess.change(this.getFolderDerivePath(fileMeta.folderDerive), `Remove file ${location}`, doc => {
      const fileIndex = doc.files.findIndex(file => arrayEquality_1.arraysEqual(unfreezeUint8Array(file.location), location));
      doc.files.splice(fileIndex, 1);
    }, markCacheDirty);
  }
  getFolderDerivePath(location) {
    return this.prefix + "/folder/" + b64_1.bytesToB64URL(location);
  }
  async getFoldersIndex(markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFoldersIndex(markCacheDirty));
  }
  async _getFoldersIndex(markCacheDirty = false) {
    const foldersIndex = (await this.config.metadataAccess.get(this.indexes.folders, markCacheDirty)) || automerge_1d.default.from({
      folders: []
    });
    const duplicates = new Set((foldersIndex.folders || []).map(({path}) => path).filter((p, i, arr) => arr.indexOf(p) != i));
    for (let dup of duplicates) {}
    return {
      folders: (foldersIndex.folders || []).map(folder => ({
        location: unfreezeUint8Array(folder.location),
        path: folder.path
      }))
    };
  }
  async getFolderIndexEntryByPath(path, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFolderIndexEntryByPath(path, markCacheDirty));
  }
  async _getFolderIndexEntryByPath(path, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    validateDirectoryPath(path);
    const foldersIndex = await this._getFoldersIndex(markCacheDirty);
    const folderEntry = foldersIndex.folders.find(folder => folder.path == path);
    if (!folderEntry) {
      throw new AccountSystemNotFoundError("folder", path);
    }
    return {
      location: folderEntry.location,
      path: folderEntry.path
    };
  }
  async getFoldersInFolderByPath(path, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFoldersInFolderByPath(path, markCacheDirty));
  }
  async _getFoldersInFolderByPath(path, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    validateDirectoryPath(path);
    const foldersIndex = await this._getFoldersIndex(markCacheDirty);
    return foldersIndex.folders.filter(folder => path_1.isPathChild(path, folder.path));
  }
  async getAllFoldersInFolderRecursivelyByPath(path, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getAllFoldersInFolderRecursivelyByPath(path, markCacheDirty));
  }
  async _getAllFoldersInFolderRecursivelyByPath(path, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    validateDirectoryPath(path);
    const foldersIndex = await this._getFoldersIndex(markCacheDirty);
    return (await Promise.all(foldersIndex.folders.filter(folder => path_1.isPathChild(path, folder.path)).map(async folder => [folder, await this._getAllFoldersInFolderRecursivelyByPath(folder.path)].flat()))).flat();
  }
  async getAllFilesInFolderRecursivelyByPath(path, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getAllFilesInFolderRecursivelyByPath(path, markCacheDirty));
  }
  async _getAllFilesInFolderRecursivelyByPath(path, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    validateDirectoryPath(path);
    const folderMeta = await this._getFolderMetadataByPath(path);
    const foldersInFolder = await this._getAllFoldersInFolderRecursivelyByPath(path, markCacheDirty);
    const filesIndex = await this._getFilesIndex();
    const filesInFolder = (await Promise.all(foldersInFolder.map(async folder => (await this._getFolderMetadataByPath(folder.path, markCacheDirty)).files))).flat();
    return filesIndex.files.filter(fileEntry => [].concat(folderMeta.files, filesInFolder).some(folderFileEntry => arrayEquality_1.arraysEqual(folderFileEntry.location, fileEntry.location)));
  }
  async getFoldersInFolderByLocation(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFoldersInFolderByLocation(location, markCacheDirty));
  }
  async _getFoldersInFolderByLocation(location, markCacheDirty = false) {
    const foldersIndex = await this._getFoldersIndex(markCacheDirty);
    const folderEntry = foldersIndex.folders.find(folder => arrayEquality_1.arraysEqual(folder.location, location));
    if (!folderEntry) {
      throw new AccountSystemNotFoundError("folder entry", b64_1.bytesToB64URL(location));
    }
    const path = folderEntry.path;
    return foldersIndex.folders.filter(folder => path_1.isPathChild(path, folder.path));
  }
  async getAllFoldersInFolderRecursivelyByLocation(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getAllFoldersInFolderRecursivelyByLocation(location, markCacheDirty));
  }
  async _getAllFoldersInFolderRecursivelyByLocation(location, markCacheDirty = false) {
    const foldersIndex = await this._getFoldersIndex(markCacheDirty);
    const folderEntry = foldersIndex.folders.find(folder => arrayEquality_1.arraysEqual(folder.location, location));
    if (!folderEntry) {
      throw new AccountSystemNotFoundError("folder entry", b64_1.bytesToB64URL(location));
    }
    const path = folderEntry.path;
    return (await Promise.all(foldersIndex.folders.filter(folder => path_1.isPathChild(path, folder.path)).map(async folder => [folder, await this._getAllFoldersInFolderRecursivelyByLocation(folder.location)].flat()))).flat();
  }
  async getAllFilesInFolderRecursivelyByLocation(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getAllFilesInFolderRecursivelyByLocation(location, markCacheDirty));
  }
  async _getAllFilesInFolderRecursivelyByLocation(location, markCacheDirty = false) {
    const foldersIndex = await this._getFoldersIndex(markCacheDirty);
    const folderEntry = foldersIndex.folders.find(folder => arrayEquality_1.arraysEqual(folder.location, location));
    if (!folderEntry) {
      throw new AccountSystemNotFoundError("folder entry", b64_1.bytesToB64URL(location));
    }
    const folderMeta = await this._getFolderMetadataByLocation(location);
    const foldersInFolder = await this._getAllFoldersInFolderRecursivelyByLocation(folderEntry.location, markCacheDirty);
    const filesIndex = await this._getFilesIndex();
    const filesInFolder = (await Promise.all(foldersInFolder.map(async folder => (await this._getFolderMetadataByLocation(folder.location, markCacheDirty)).files))).flat();
    return filesIndex.files.filter(fileEntry => [].concat(folderMeta.files, filesInFolder).some(folderFileEntry => arrayEquality_1.arraysEqual(folderFileEntry.location, fileEntry.location)));
  }
  async getFolderMetadataByPath(path, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFolderMetadataByPath(path, markCacheDirty));
  }
  async _getFolderMetadataByPath(path, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    const folderEntry = await this._getFolderIndexEntryByPath(path, markCacheDirty);
    return await this._getFolderMetadataByLocation(folderEntry.location, markCacheDirty);
  }
  async getFolderMetadataByLocation(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getFolderMetadataByLocation(location, markCacheDirty));
  }
  async _getFolderMetadataByLocation(location, markCacheDirty = false) {
    const folderPath = this.getFolderDerivePath(location);
    const doc = await this.config.metadataAccess.get(folderPath, markCacheDirty);
    if (!doc) {
      throw new AccountSystemNotFoundError("folder", folderPath);
    }
    return {
      location: unfreezeUint8Array(doc.location),
      name: doc.name,
      path: doc.path,
      size: doc.size,
      uploaded: doc.uploaded,
      modified: doc.modified,
      files: doc.files.map(fileEntry => ({
        location: unfreezeUint8Array(fileEntry.location),
        name: fileEntry.name
      }))
    };
  }
  async addFolder(path, markCacheDirty = false) {
    await this.config.metadataAccess.markCacheDirty(this.indexes.folders);
    return await this._m.runExclusive(() => this._addFolder(path, markCacheDirty));
  }
  async _addFolder(path, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    validateDirectoryPath(path);
    if (path != "/") {
      await this._addFolder(path_browserify_1.posix.dirname(path), markCacheDirty);
    }
    let foldersIndexDoc = await this._getFoldersIndex(markCacheDirty);
    const dup = foldersIndexDoc.folders.find(entry => entry.path == path);
    if (dup) {
      return this._getFolderMetadataByLocation(dup.location);
    }
    const location = await this.config.metadataAccess.config.crypto.getRandomValues(32);
    await this.config.metadataAccess.change(this.indexes.folders, "Add folder to index", doc => {
      if (!doc.folders) {
        doc.folders = [];
      }
      doc.folders.push({
        location: location,
        path
      });
    }, markCacheDirty);
    const doc = await this.config.metadataAccess.change(this.getFolderDerivePath(location), "Init folder metadata", doc => {
      doc.location = location;
      doc.name = path_browserify_1.posix.basename(path);
      doc.path = path;
      doc.modified = Date.now();
      doc.size = 0;
      doc.uploaded = Date.now();
      doc.files = [];
    }, markCacheDirty);
    return {
      location: unfreezeUint8Array(doc.location),
      name: doc.name,
      path: doc.path,
      size: doc.size,
      uploaded: doc.uploaded,
      modified: doc.modified,
      files: doc.files.map(file => ({
        location: unfreezeUint8Array(file.location),
        name: file.name
      }))
    };
  }
  async renameFolder(path, newName, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._renameFolder(path, newName, markCacheDirty));
  }
  async _renameFolder(path, newName, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    validateDirectoryPath(path);
    validateFilename(newName);
    return await this._moveFolder(path, path_browserify_1.posix.join(path_browserify_1.posix.dirname(path), newName), markCacheDirty);
  }
  async moveFolder(oldPath, newPath, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._moveFolder(oldPath, newPath, markCacheDirty));
  }
  async _moveFolder(oldPath, newPath, markCacheDirty = false) {
    oldPath = path_1.cleanPath(oldPath);
    newPath = path_1.cleanPath(newPath);
    validateDirectoryPath(oldPath);
    validateDirectoryPath(newPath);
    const op = path_browserify_1.posix.dirname(oldPath) == path_browserify_1.posix.dirname(newPath) ? "Rename" : "Move";
    const newFolder = await this._getFolderIndexEntryByPath(newPath, markCacheDirty).catch(() => {});
    if (newFolder) {
      throw new AccountSystemAlreadyExistsError("folder", newPath);
    }
    const folderEntry = await this._getFolderIndexEntryByPath(oldPath, markCacheDirty);
    if (!folderEntry) {
      throw new AccountSystemNotFoundError("folder", oldPath);
    }
    await this.config.metadataAccess.markCacheDirty(this.indexes.folders);
    const foldersIndex = await this._getFoldersIndex(markCacheDirty);
    await this.config.metadataAccess.change(this.indexes.folders, `${op} folder`, doc => {
      const subs = doc.folders.filter(folderEntry => path_browserify_1.posix.relative(oldPath, folderEntry.path).indexOf("../") != 0);
      for (let folderEntry of subs) {
        folderEntry.path = path_browserify_1.posix.join(newPath, path_browserify_1.posix.relative(oldPath, folderEntry.path));
      }
    }, markCacheDirty);
    const subs = foldersIndex.folders.filter(folderEntry => {
      const rel = path_browserify_1.posix.relative(oldPath, folderEntry.path);
      return rel != "" && rel.indexOf("../") != 0;
    });
    for (let folderEntry of subs) {
      await this.config.metadataAccess.change(this.getFolderDerivePath(folderEntry.location), `${op} folder`, doc => {
        doc.path = path_browserify_1.posix.join(newPath, path_browserify_1.posix.relative(oldPath, folderEntry.path));
      }, markCacheDirty);
    }
    const doc = await this.config.metadataAccess.change(this.getFolderDerivePath(folderEntry.location), `${op} folder`, doc => {
      doc.name = path_browserify_1.posix.basename(newPath);
      doc.path = newPath;
    }, markCacheDirty);
    return {
      location: unfreezeUint8Array(doc.location),
      name: doc.name,
      path: doc.path,
      size: doc.size,
      uploaded: doc.uploaded,
      modified: doc.modified,
      files: doc.files.map(file => ({
        location: unfreezeUint8Array(file.location),
        name: file.name
      }))
    };
  }
  async removeFolderByPath(path, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._removeFolderByPath(path, markCacheDirty));
  }
  async _removeFolderByPath(path, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    const folderEntry = await this._getFolderIndexEntryByPath(path, markCacheDirty);
    return await this._removeFolderByLocation(folderEntry.location, markCacheDirty);
  }
  async removeFolderByLocation(location, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._removeFolderByLocation(location, markCacheDirty));
  }
  async _removeFolderByLocation(location, markCacheDirty = false) {
    const folderMeta = await this._getFolderMetadataByLocation(location, markCacheDirty);
    if (folderMeta.files.length) {
      throw new AccountSystemNotEmptyError("folder", b64_1.bytesToB64URL(location), "remove");
    }
    const childFolders = await this._getFoldersInFolderByLocation(location, markCacheDirty);
    await Promise.all(childFolders.map(folder => this._removeFolderByLocation(folder.location)));
    await this.config.metadataAccess.delete(this.getFolderDerivePath(location));
    await this.config.metadataAccess.change(this.indexes.folders, `Remove folder ${b64_1.bytesToB64URL(location)}`, doc => {
      const folderIndex = doc.folders.findIndex(file => arrayEquality_1.arraysEqual(unfreezeUint8Array(file.location), location));
      doc.folders.splice(folderIndex, 1);
    }, markCacheDirty);
  }
  getShareHandle(meta) {
    return new Uint8Array(Array.from(meta.locationKey).concat(Array.from(meta.encryptionKey)));
  }
  async getShareIndex(markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getShareIndex(markCacheDirty));
  }
  async _getShareIndex(markCacheDirty = false) {
    const sharedIndex = (await this.config.metadataAccess.get(this.indexes.share, markCacheDirty)) || automerge_1d.default.from({
      shared: []
    });
    return {
      shared: sharedIndex.shared.map(shareEntry => ({
        locationKey: unfreezeUint8Array(shareEntry.locationKey),
        encryptionKey: unfreezeUint8Array(shareEntry.encryptionKey),
        fileHandles: shareEntry.fileHandles.map(h => unfreezeUint8Array(h)),
        fileLocations: shareEntry.fileLocations.map(l => unfreezeUint8Array(l))
      }))
    };
  }
  async getSharesByHandle(handle, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._getSharesByHandle(handle, markCacheDirty));
  }
  async _getSharesByHandle(handle, markCacheDirty = false) {
    const shareIndex = await this._getShareIndex(markCacheDirty);
    return shareIndex.shared.filter(share => share.fileHandles.findIndex(h => arrayEquality_1.arraysEqual(handle, h)) != -1);
  }
  async share(filesInit, markCacheDirty = false) {
    return await this._m.runExclusive(() => this._share(filesInit, markCacheDirty));
  }
  async _share(filesInit, markCacheDirty = false) {
    const files = await Promise.all(filesInit.map(async fileInit => {
      const meta = await this._getFileMetadata(fileInit.location, markCacheDirty);
      return {
        modified: meta.modified,
        uploaded: meta.uploaded,
        name: meta.name,
        path: fileInit.path,
        size: meta.size,
        type: meta.type,
        finished: !!meta.finished,
        private: meta.private,
        public: meta.public
      };
    }));
    const locationKey = await mnemonic_1.entropyToKey(await this.config.metadataAccess.config.crypto.getRandomValues(32));
    const encryptionKey = await this.config.metadataAccess.config.crypto.getRandomValues(32);
    await this.config.metadataAccess.change(this.indexes.share, "Share files", doc => {
      if (!doc.shared) {
        doc.shared = [];
      }
      doc.shared.push({
        locationKey,
        encryptionKey,
        fileHandles: files.map(f => f.private.handle).filter(Boolean),
        fileLocations: files.map(f => f.public.location).filter(Boolean)
      });
    }, markCacheDirty);
    const shareMeta = await this.config.metadataAccess.changePublic(locationKey, "Share files", doc => {
      doc.locationKey = locationKey;
      doc.encryptionKey = encryptionKey;
      doc.dateShared = Date.now();
      doc.files = files;
    }, encryptionKey, markCacheDirty);
    return {
      locationKey: unfreezeUint8Array(shareMeta.locationKey),
      encryptionKey: unfreezeUint8Array(shareMeta.encryptionKey),
      dateShared: shareMeta.dateShared,
      files: shareMeta.files.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        uploaded: file.uploaded,
        modified: file.modified,
        type: file.type,
        finished: !!file.finished,
        private: {
          handle: ((_22_ = (_21_ = file) === null || _21_ === void 0 ? void 0 : _21_.private) === null || _22_ === void 0 ? void 0 : _22_.handle) ? unfreezeUint8Array(file.private.handle) : null
        },
        public: {
          location: ((_24_ = (_23_ = file) === null || _23_ === void 0 ? void 0 : _23_.public) === null || _24_ === void 0 ? void 0 : _24_.location) ? unfreezeUint8Array(file.public.location) : null
        }
      }))
    };
  }
  async getShared(locationKey, encryptionKey, markCacheDirty = false) {
    const handle = arrayMerge_1.arrayMerge(locationKey, encryptionKey);
    const shareMeta = await this.config.metadataAccess.getPublic(locationKey, encryptionKey, markCacheDirty);
    if (!shareMeta) {
      throw new AccountSystemNotFoundError("shared", b64_1.bytesToB64URL(handle));
    }
    return {
      locationKey: unfreezeUint8Array(shareMeta.locationKey),
      encryptionKey: unfreezeUint8Array(shareMeta.encryptionKey),
      dateShared: shareMeta.dateShared,
      files: shareMeta.files.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        uploaded: file.uploaded,
        modified: file.modified,
        type: file.type,
        finished: !!file.finished,
        private: {
          handle: ((_26_ = (_25_ = file) === null || _25_ === void 0 ? void 0 : _25_.private) === null || _26_ === void 0 ? void 0 : _26_.handle) ? unfreezeUint8Array(file.private.handle) : null
        },
        public: {
          location: ((_28_ = (_27_ = file) === null || _27_ === void 0 ? void 0 : _27_.public) === null || _28_ === void 0 ? void 0 : _28_.location) ? unfreezeUint8Array(file.public.location) : null
        }
      }))
    };
  }
}
exports.AccountSystem = AccountSystem;

},

// ../v2-account-migrator/ts-client-library/packages/account-system/src/MetadataAccess.ts @16
16: function(__fusereq, exports, module){
exports.__esModule = true;
var async_mutex_1 = __fusereq(34);
var automerge_1 = __fusereq(36);
var automerge_1d = __fuse.dt(automerge_1);
var sha256_1 = __fusereq(41);
var sha256_1d = __fuse.dt(sha256_1);
var b64_1 = __fusereq(14);
var path_1 = __fusereq(38);
var dag_1 = __fusereq(42);
var payload_1 = __fusereq(13);
var uint_1 = __fusereq(43);
const sha256 = d => {
  const digest = new sha256_1d.default("SHA-256", "UINT8ARRAY");
  digest.update(d);
  return digest.getHash("UINT8ARRAY");
};
const packChanges = changes => {
  const len = 4 + 4 * changes.length + changes.reduce((acc, cur) => acc + cur.length, 0);
  const packed = new Uint8Array(len);
  let i = 0;
  const lArr = uint_1.uint32ToUint8BE(changes.length);
  packed[i + 0] = lArr[0];
  packed[i + 1] = lArr[1];
  packed[i + 2] = lArr[2];
  packed[i + 3] = lArr[3];
  i += 4;
  for (let change of changes) {
    const lArr2 = uint_1.uint32ToUint8BE(change.length);
    packed[i + 0] = lArr2[0];
    packed[i + 1] = lArr2[1];
    packed[i + 2] = lArr2[2];
    packed[i + 3] = lArr2[3];
    i += 4;
    for (let n = 0; n < change.length; n++) {
      packed[i + n] = change[n];
    }
    i += change.length;
  }
  return packed;
};
const unpackChanges = packed => {
  let i = 0;
  const changes = [];
  const len = uint_1.readUInt32BE(packed, i);
  i += 4;
  for (let c = 0; c < len; c++) {
    const l = uint_1.readUInt32BE(packed, i);
    i += 4;
    changes.push(packed.slice(i, i + l));
    i += l;
  }
  return changes;
};
class MetadataAccess {
  constructor(config) {
    this.dags = {};
    this.cache = {};
    this.metadataIndexPath = "/metadata-index";
    this._sem = new async_mutex_1.Semaphore(3);
    this.config = config;
  }
  async markCacheDirty(path) {
    const priv = await this.config.crypto.derive(undefined, path);
    const pub = await this.config.crypto.getPublicKey(priv);
    return this._markCacheDirty(pub);
  }
  _markCacheDirty(pub) {
    const pubString = b64_1.bytesToB64URL(pub);
    const cached = this.cache[pubString];
    if (cached) {
      cached.dirty = true;
    }
  }
  async getMetadataLocationKeysList() {
    const priv = await this.config.crypto.derive(undefined, this.metadataIndexPath);
    const metaIndexObject = (await this._get(priv, undefined, true)) || ({});
    const metaIndexPrivs = [b64_1.bytesToB64URL(priv)].concat(Object.keys(metaIndexObject.privs));
    const validLocations = (await Promise.all(metaIndexPrivs.map(privString => {
      return this._sem.runExclusive(async () => {
        const priv = b64_1.b64URLToBytes(privString);
        const pub = await this.config.crypto.getPublicKey(priv);
        const pubString = b64_1.bytesToB64URL(pub);
        const payload = await payload_1.getPayload({
          crypto: this.config.crypto,
          payload: {
            metadataV2Key: pubString
          }
        });
        const res = await this.config.net.POST(this.config.metadataNode + "/api/v2/metadata/get", undefined, JSON.stringify(payload), res => new Response(res).json());
        if (res.data == "Key not found") {
          return undefined;
        }
        return pub;
      });
    }))).filter(Boolean);
    return validLocations;
  }
  async _metadataIndexAdd(priv, encryptKey) {
    const privString = b64_1.bytesToB64URL(priv);
    const encryptKeyString = encryptKey ? b64_1.bytesToB64URL(encryptKey) : undefined;
    const metaIndexPriv = await this.config.crypto.derive(undefined, this.metadataIndexPath);
    const doc = await this._get(metaIndexPriv, undefined, false);
    if (doc && (privString in doc.privs)) {
      return;
    }
    await this._change(metaIndexPriv, undefined, doc => {
      if ((privString in doc)) {
        return;
      }
      if (!doc.privs) {
        doc.privs = {};
      }
      if (!doc.encryptKeys) {
        doc.encryptKeys = {};
      }
      doc.privs[privString] = true;
      if (encryptKeyString) {
        doc.encryptKeys[privString] = encryptKeyString;
      }
    }, false, undefined, true);
  }
  async _metadataIndexRemove(priv) {
    const privString = b64_1.bytesToB64URL(priv);
    const metaIndexPriv = await this.config.crypto.derive(undefined, this.metadataIndexPath);
    const doc = await this._get(metaIndexPriv, undefined, false);
    if (doc && !((privString in doc.privs))) {
      return;
    }
    await this._change(metaIndexPriv, undefined, doc => {
      if ((privString in doc)) {
        return;
      }
      delete doc.privs[privString];
      delete doc.encryptKeys[privString];
    }, false, undefined, true);
  }
  async change(path, description, fn, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    const priv = await this.config.crypto.derive(undefined, path);
    await this._metadataIndexAdd(priv, undefined);
    return await this._change(priv, description, fn, false, undefined, markCacheDirty);
  }
  async changePublic(priv, description, fn, encryptKey, markCacheDirty = false) {
    await this._metadataIndexAdd(priv, encryptKey);
    return await this._change(priv, description, fn, true, encryptKey, markCacheDirty);
  }
  async _change(priv, description, fn, isPublic, encryptKey, markCacheDirty = false) {
    const pub = await this.config.crypto.getPublicKey(priv);
    const pubString = b64_1.bytesToB64URL(pub);
    const curDoc = (await this._get(priv, undefined, markCacheDirty)) || automerge_1d.default.init();
    this.dags[pubString] = this.dags[pubString] || new dag_1.DAG();
    const dag = this.dags[pubString];
    const newDoc = description ? automerge_1d.default.change(curDoc, description, fn) : automerge_1d.default.change(curDoc, fn);
    const changes = automerge_1d.default.getChanges(curDoc, newDoc);
    if (!changes.length) {
      return curDoc;
    }
    const encrypted = await this.config.crypto.encrypt(encryptKey || sha256(priv), packChanges(changes));
    const v = new dag_1.DAGVertex(encrypted);
    dag.addReduced(v);
    const edges = dag.parentEdges(v.id);
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {
        isPublic,
        metadataV2Edges: edges.map(edge => b64_1.bytesToB64URL(edge.binary)),
        metadataV2Key: pubString,
        metadataV2Sig: b64_1.bytesToB64URL(await this.config.crypto.sign(priv, await dag.digest(v.id, sha256))),
        metadataV2Vertex: b64_1.bytesToB64URL(v.binary)
      }
    });
    await this.config.net.POST(this.config.metadataNode + "/api/v2/metadata/add", undefined, JSON.stringify(payload), res => new Response(res).json());
    this.dags[pubString] = dag;
    this.cache[pubString] = {
      lastAccess: Date.now(),
      dirty: false,
      doc: newDoc
    };
    setTimeout(() => {
      delete this.dags[pubString];
      delete this.cache[pubString];
    }, 60 * 1000);
    return newDoc;
  }
  async get(path, markCacheDirty = false) {
    path = path_1.cleanPath(path);
    const priv = await this.config.crypto.derive(undefined, path);
    return await this._get(priv, undefined, markCacheDirty);
  }
  async _get(priv, decryptKey, markCacheDirty = false) {
    const pub = await this.config.crypto.getPublicKey(priv);
    const pubString = b64_1.bytesToB64URL(pub);
    const cached = this.cache[pubString];
    if (markCacheDirty || !cached || cached.dirty == true) {
      if (this.config.logging) {
        console.warn("Cache: cache not used for", pubString, "because", !cached ? "item was not found in cache" : "cache entry was marked dirty");
      }
      const payload = await payload_1.getPayload({
        crypto: this.config.crypto,
        payload: {
          metadataV2Key: pubString
        }
      });
      const res = await this.config.net.POST(this.config.metadataNode + "/api/v2/metadata/get", undefined, JSON.stringify(payload), res => new Response(res).json());
      if (res.data == "Key not found") {
        return undefined;
      }
      const dag = dag_1.DAG.fromBinary(b64_1.b64URLToBytes(res.data.metadataV2));
      this.dags[pubString] = dag;
    } else {
      if (this.config.logging) {
        console.info("Cache: using cached value for", pubString);
      }
      cached.lastAccess = Date.now();
      return cached.doc;
    }
    const decrypted = await Promise.all(this.dags[pubString].nodes.map(({data}) => this.config.crypto.decrypt(decryptKey || sha256(priv), data)));
    const changes = decrypted.map(data => unpackChanges(data)).flat();
    const doc = automerge_1d.default.applyChanges(automerge_1d.default.init(), changes);
    this.cache[pubString] = {
      lastAccess: Date.now(),
      dirty: false,
      doc
    };
    setTimeout(() => {
      delete this.dags[pubString];
      delete this.cache[pubString];
    }, 60 * 1000);
    return doc;
  }
  async getPublic(priv, decryptKey, markCacheDirty = false) {
    return await this._getPublic(priv, decryptKey);
  }
  async _getPublic(priv, decryptKey, markCacheDirty = false) {
    const pub = await this.config.crypto.getPublicKey(priv);
    const pubString = b64_1.bytesToB64URL(pub);
    const cached = this.cache[pubString];
    if (markCacheDirty || !cached || cached.dirty == true) {
      if (this.config.logging) {
        console.warn("Cache: cache not used for", pubString, "because", !cached ? "item was not found in cache" : "cache entry was marked dirty");
      }
      const res = await this.config.net.POST(this.config.metadataNode + "/api/v2/metadata/get-public", undefined, JSON.stringify({
        requestBody: JSON.stringify({
          metadataV2Key: pubString,
          timestamp: Math.floor(Date.now() / 1000)
        })
      }), res => new Response(res).json());
      const dag = dag_1.DAG.fromBinary(b64_1.b64URLToBytes(res.data.metadataV2));
      this.dags[pubString] = dag;
    } else {
      if (this.config.logging) {
        console.info("Cache: using cached value for", pubString);
      }
      return cached.doc;
    }
    const decrypted = await Promise.all(this.dags[pubString].nodes.map(({data}) => this.config.crypto.decrypt(decryptKey, data)));
    const changes = decrypted.map(data => unpackChanges(data)).flat();
    const doc = automerge_1d.default.applyChanges(automerge_1d.default.init(), changes);
    this.cache[pubString] = {
      lastAccess: Date.now(),
      dirty: false,
      doc
    };
    setTimeout(() => {
      delete this.dags[pubString];
      delete this.cache[pubString];
    }, 60 * 1000);
    return doc;
  }
  async delete(path) {
    path = path_1.cleanPath(path);
    const priv = await this.config.crypto.derive(undefined, path);
    await this._delete(priv);
    await this._metadataIndexRemove(priv);
  }
  async deletePublic(priv) {
    await this._delete(priv);
    await this._metadataIndexRemove(priv);
  }
  async _delete(priv) {
    const pub = await this.config.crypto.getPublicKey(priv);
    const pubString = b64_1.bytesToB64URL(pub);
    const payload = await payload_1.getPayload({
      crypto: this.config.crypto,
      payload: {
        metadataV2Key: pubString
      }
    });
    await this.config.net.POST(this.config.metadataNode + "/api/v2/metadata/delete", undefined, JSON.stringify(payload), res => new Response(res).json());
    delete this.dags[pubString];
    delete this.cache[pubString];
  }
}
exports.MetadataAccess = MetadataAccess;

},

// ../v2-account-migrator/opaque/src/utils/hashToPath.ts @26
26: function(__fusereq, exports, module){
exports.__esModule = true;
const hashToPath = (h, {prefix = false} = {}) => {
  if (h.length % 4) {
    throw new Error("hash length must be multiple of two bytes");
  }
  return (prefix ? "m/" : "") + h.match(/.{1,4}/g).map(p => parseInt(p, 16)).join("'/") + "'";
};
exports.hashToPath = hashToPath;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/index.ts @27
27: function(__fusereq, exports, module){
exports.__esModule = true;
var downloadFile_1 = __fusereq(67);
var generateSubHDKey_1 = __fusereq(68);
var getAccountInfo_1 = __fusereq(69);
var getFolderHDKey_1 = __fusereq(70);
var getFolderLocation_1 = __fusereq(71);
var getHandle_1 = __fusereq(72);
var isPaid_1 = __fusereq(73);
var register_1 = __fusereq(74);
var buildFullTree_1 = __fusereq(75);
var createFolder_1 = __fusereq(76);
var createFolderMeta_1 = __fusereq(77);
var createMetaQueue_1 = __fusereq(78);
var deleteFile_1 = __fusereq(79);
var deleteFolder_1 = __fusereq(80);
var deleteFolderMeta_1 = __fusereq(81);
var deleteVersion_1 = __fusereq(82);
var getFolderMeta_1 = __fusereq(83);
var isExpired_1 = __fusereq(84);
var login_1 = __fusereq(85);
var moveFile_1 = __fusereq(86);
var moveFolder_1 = __fusereq(87);
var renameFile_1 = __fusereq(88);
var renameFolder_1 = __fusereq(89);
var renewAccount_1 = __fusereq(90);
var setFolderMeta_1 = __fusereq(91);
var upgradeAccount_1 = __fusereq(92);
var uploadFile_1 = __fusereq(93);
exports.downloadFile = downloadFile_1.downloadFile;
exports.generateSubHDKey = generateSubHDKey_1.generateSubHDKey;
exports.getAccountInfo = getAccountInfo_1.getAccountInfo;
exports.getFolderHDKey = getFolderHDKey_1.getFolderHDKey;
exports.getFolderLocation = getFolderLocation_1.getFolderLocation;
exports.getHandle = getHandle_1.getHandle;
exports.isPaid = isPaid_1.isPaid;
exports.register = register_1.register;
exports.buildFullTree = buildFullTree_1.buildFullTree;
exports.createFolder = createFolder_1.createFolder;
exports.createFolderMeta = createFolderMeta_1.createFolderMeta;
exports.createMetaQueue = createMetaQueue_1.createMetaQueue;
exports.deleteFile = deleteFile_1.deleteFile;
exports.deleteFolder = deleteFolder_1.deleteFolder;
exports.deleteFolderMeta = deleteFolderMeta_1.deleteFolderMeta;
exports.deleteVersion = deleteVersion_1.deleteVersion;
exports.getFolderMeta = getFolderMeta_1.getFolderMeta;
exports.isExpired = isExpired_1.isExpired;
exports.login = login_1.login;
exports.moveFile = moveFile_1.moveFile;
exports.MoveFileArgs = moveFile_1.MoveFileArgs;
exports.moveFolder = moveFolder_1.moveFolder;
exports.MoveFolderArgs = moveFolder_1.MoveFolderArgs;
exports.renameFile = renameFile_1.renameFile;
exports.RenameFileArgs = renameFile_1.RenameFileArgs;
exports.renameFolder = renameFolder_1.renameFolder;
exports.RenameFolderArgs = renameFolder_1.RenameFolderArgs;
exports.renewAccount = renewAccount_1.renewAccount;
exports.setFolderMeta = setFolderMeta_1.setFolderMeta;
exports.upgradeAccount = upgradeAccount_1.upgradeAccount;
exports.uploadFile = uploadFile_1.uploadFile;
const v1 = {
  downloadFile: downloadFile_1.downloadFile,
  generateSubHDKey: generateSubHDKey_1.generateSubHDKey,
  getAccountInfo: getAccountInfo_1.getAccountInfo,
  getFolderHDKey: getFolderHDKey_1.getFolderHDKey,
  getFolderLocation: getFolderLocation_1.getFolderLocation,
  getHandle: getHandle_1.getHandle,
  isPaid: isPaid_1.isPaid,
  register: register_1.register,
  buildFullTree: buildFullTree_1.buildFullTree,
  createFolder: createFolder_1.createFolder,
  createFolderMeta: createFolderMeta_1.createFolderMeta,
  createMetaQueue: createMetaQueue_1.createMetaQueue,
  deleteFile: deleteFile_1.deleteFile,
  deleteFolder: deleteFolder_1.deleteFolder,
  deleteFolderMeta: deleteFolderMeta_1.deleteFolderMeta,
  deleteVersion: deleteVersion_1.deleteVersion,
  getFolderMeta: getFolderMeta_1.getFolderMeta,
  isExpired: isExpired_1.isExpired,
  login: login_1.login,
  moveFile: moveFile_1.moveFile,
  moveFolder: moveFolder_1.moveFolder,
  renameFile: renameFile_1.renameFile,
  renameFolder: renameFolder_1.renameFolder,
  renewAccount: renewAccount_1.renewAccount,
  setFolderMeta: setFolderMeta_1.setFolderMeta,
  upgradeAccount: upgradeAccount_1.upgradeAccount,
  uploadFile: uploadFile_1.uploadFile
};
exports.default = v1;

},

// ../v2-account-migrator/ts-client-library/packages/middleware-web/src/webAccountMiddleware.ts @28
28: function(__fusereq, exports, module){
var buffer = __fusereq(17);
exports.__esModule = true;
var Buffer = buffer;
var hdkey_1 = __fusereq(94);
var hdkey_1d = __fuse.dt(hdkey_1);
var middleware_1 = __fusereq(102);
var derive_1 = __fusereq(103);
class WebAccountMiddleware {
  constructor({symmetricKey, asymmetricKey} = {}) {
    this.asymmetricKey = asymmetricKey;
    this.symmetricKey = symmetricKey;
  }
  async getRandomValues(size) {
    return crypto.getRandomValues(new Uint8Array(size));
  }
  async getPublicKey(k = this.asymmetricKey) {
    if (k == undefined) {
      throw new ReferenceError("WebAccountMiddleware: key must not be undefined");
    }
    const hd = new hdkey_1d.default();
    hd.privateKey = Buffer.from(k.slice(0, 32));
    hd.chainCode = Buffer.from(k.slice(32));
    return hd.publicKey;
  }
  async derive(k = this.asymmetricKey, p) {
    if (k == undefined) {
      throw new ReferenceError("WebAccountMiddleware: key must not be undefined");
    }
    const hd = new hdkey_1d.default();
    hd.privateKey = Buffer.from(k.slice(0, 32));
    hd.chainCode = Buffer.from(k.slice(32));
    const child = hd.derive("m/" + derive_1.hashToPath(derive_1.pathHash(p)));
    return new Uint8Array(Array.from(child.privateKey).concat(Array.from(child.chainCode)));
  }
  async sign(k = this.asymmetricKey, d) {
    if (k == undefined) {
      throw new ReferenceError("WebAccountMiddleware: key must not be undefined");
    }
    const hd = new hdkey_1d.default();
    hd.privateKey = Buffer.from(k.slice(0, 32));
    hd.chainCode = Buffer.from(k.slice(32));
    const sig = hd.sign(Buffer.from(d));
    return sig;
  }
  async generateSymmetricKey() {
    const key = await crypto.subtle.exportKey("raw", await crypto.subtle.generateKey({
      name: "AES-GCM",
      length: 256
    }, true, ["encrypt", "decrypt"]));
    return new Uint8Array(key);
  }
  async encrypt(k = this.symmetricKey, d) {
    if (k == undefined) {
      throw new ReferenceError("WebAccountMiddleware: key must not be undefined");
    }
    const key = await crypto.subtle.importKey("raw", k, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv,
      tagLength: 128
    }, key, d));
    return new Uint8Array([...encrypted, ...iv]);
  }
  async decrypt(k = this.symmetricKey, ct) {
    if (k == undefined) {
      throw new ReferenceError("WebAccountMiddleware: key must not be undefined");
    }
    const key = await crypto.subtle.importKey("raw", k, "AES-GCM", false, ["decrypt"]);
    return new Uint8Array(await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: ct.slice(-16)
    }, key, ct.slice(0, -16)));
  }
}
exports.WebAccountMiddleware = WebAccountMiddleware;

},

// ../v2-account-migrator/ts-client-library/packages/middleware-web/src/webNetworkMiddleware.ts @29
29: function(__fusereq, exports, module){
exports.__esModule = true;
var middleware_1 = __fusereq(102);
const fetchAdapter = async (method, address, headers, body, mapReturn) => {
  const res = await fetch(address, {
    method,
    body,
    headers
  });
  return {
    headers: res.headers,
    data: await mapReturn(res.body || undefined),
    ok: res.ok,
    redirected: res.redirected,
    status: res.status,
    statusText: res.statusText,
    url: address
  };
};
class WebNetworkMiddleware {
  constructor() {
    this.GET = async (address, headers, body, mapReturn = async b => new Uint8Array(await new Response(b).arrayBuffer())) => {
      return await fetchAdapter("GET", address, headers, body, mapReturn);
    };
  }
  async POST(address, headers, body, mapReturn = async b => new Uint8Array(await new Response(b).arrayBuffer())) {
    return await fetchAdapter("POST", address, headers, body, mapReturn);
  }
}
exports.WebNetworkMiddleware = WebNetworkMiddleware;

},

// ../v2-account-migrator/ts-client-library/packages/filesystem-access/src/events.ts @30
30: function(__fusereq, exports, module){
var DownloadEvents;
(function (DownloadEvents) {
  DownloadEvents["METADATA"] = "metadata";
  DownloadEvents["START"] = "start";
  DownloadEvents["FINISH"] = "finish";
  DownloadEvents["PROGRESS"] = "progress";
})(DownloadEvents || (DownloadEvents = {}))
exports.DownloadEvents = DownloadEvents;
class DownloadMetadataEvent extends CustomEvent {
  constructor(data) {
    super(DownloadEvents.METADATA, {
      detail: data
    });
  }
}
exports.DownloadMetadataEvent = DownloadMetadataEvent;
class DownloadStartedEvent extends CustomEvent {
  constructor(data) {
    super(DownloadEvents.START, {
      detail: data
    });
  }
}
exports.DownloadStartedEvent = DownloadStartedEvent;
class DownloadFinishedEvent extends CustomEvent {
  constructor(data) {
    super(DownloadEvents.FINISH, {
      detail: data
    });
  }
}
exports.DownloadFinishedEvent = DownloadFinishedEvent;
class DownloadProgressEvent extends CustomEvent {
  constructor(data) {
    super(DownloadEvents.PROGRESS, {
      detail: data
    });
  }
}
exports.DownloadProgressEvent = DownloadProgressEvent;
var UploadEvents;
(function (UploadEvents) {
  UploadEvents["METADATA"] = "metadata";
  UploadEvents["START"] = "start";
  UploadEvents["FINISH"] = "finish";
  UploadEvents["PROGRESS"] = "progress";
})(UploadEvents || (UploadEvents = {}))
exports.UploadEvents = UploadEvents;
class UploadMetadataEvent extends CustomEvent {
  constructor(data) {
    super(UploadEvents.METADATA, {
      detail: data
    });
  }
}
exports.UploadMetadataEvent = UploadMetadataEvent;
class UploadStartedEvent extends CustomEvent {
  constructor(data) {
    super(UploadEvents.START, {
      detail: data
    });
  }
}
exports.UploadStartedEvent = UploadStartedEvent;
class UploadFinishedEvent extends CustomEvent {
  constructor(data) {
    super(UploadEvents.FINISH, {
      detail: data
    });
  }
}
exports.UploadFinishedEvent = UploadFinishedEvent;
class UploadProgressEvent extends CustomEvent {
  constructor(data) {
    super(UploadEvents.PROGRESS, {
      detail: data
    });
  }
}
exports.UploadProgressEvent = UploadProgressEvent;
var FileSystemObjectEvents;
(function (FileSystemObjectEvents) {
  FileSystemObjectEvents["DELETE"] = "delete";
})(FileSystemObjectEvents || (FileSystemObjectEvents = {}))
exports.FileSystemObjectEvents = FileSystemObjectEvents;
class FileSystemObjectDeleteEvent extends CustomEvent {
  constructor(data) {
    super(FileSystemObjectEvents.DELETE, {
      detail: data
    });
  }
}
exports.FileSystemObjectDeleteEvent = FileSystemObjectDeleteEvent;

},

// ../v2-account-migrator/ts-client-library/packages/util/src/serializeEncrypted.ts @31
31: function(__fusereq, exports, module){
exports.__esModule = true;
exports.serializeEncrypted = async (crypto, bytes, key) => {
  const v = await crypto.decrypt(key, bytes);
  const s = new TextDecoder("utf-8").decode(v);
  return JSON.parse(s);
};

},

// ../v2-account-migrator/ts-client-library/packages/util/src/arrayEquality.ts @37
37: function(__fusereq, exports, module){
exports.__esModule = true;
exports.arraysEqual = (a, b) => {
  for (let i = a.length; -1 < i; i -= 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

},

// ../v2-account-migrator/ts-client-library/packages/util/src/path.ts @38
38: function(__fusereq, exports, module){
exports.__esModule = true;
var path_browserify_1 = __fusereq(113);
exports.cleanPath = path => {
  if (path[0] != path_browserify_1.posix.sep) {
    throw new Error("Path must be absolute");
  }
  return "/" + path_browserify_1.posix.normalize(path).split(path_browserify_1.posix.sep).filter(d => d != "").join(path_browserify_1.posix.sep);
};
exports.isPathChild = (parent, other) => {
  const rel = path_browserify_1.posix.relative(parent, other);
  if (rel != "" && rel[0] != "." && rel.split(path_browserify_1.posix.sep).length == 1) {
    return true;
  }
  return false;
};

},

// ../v2-account-migrator/ts-client-library/packages/util/src/mnemonic.ts @39
39: function(__fusereq, exports, module){
exports.__esModule = true;
var hdkey_1 = __fusereq(114);
var bip39_1 = __fusereq(122);
var derive_1 = __fusereq(103);
var hex_1 = __fusereq(4);
exports.ACCOUNT_DERIVE_PATH = "m/43'/60'/1775'/0'/" + derive_1.hashToPath(derive_1.nameHash("opacity.io"));
exports.createMnemonic = async () => {
  return bip39_1.generateMnemonic().split(" ");
};
exports.mnemonicToHandle = async mnemonic => {
  const seed = await bip39_1.mnemonicToSeed(mnemonic.join(" "));
  const hd = hdkey_1.fromMasterSeed(seed).derive(exports.ACCOUNT_DERIVE_PATH);
  return new Uint8Array(Array.from(hd.privateKey).concat(Array.from(hd.chainCode)));
};
exports.entropyToKey = async entropy => {
  const hex = hex_1.bytesToHex(entropy);
  const mnemonic = bip39_1.entropyToMnemonic(hex);
  const seed = await bip39_1.mnemonicToSeed(mnemonic);
  const hd = hdkey_1.fromMasterSeed(seed);
  return new Uint8Array(hd.privateKey);
};

},

// ../v2-account-migrator/ts-client-library/packages/util/src/arrayMerge.ts @40
40: function(__fusereq, exports, module){
exports.__esModule = true;
exports.arrayMerge = (...arr) => {
  if (arr.length == 0) {
    return [];
  }
  const l = arr.reduce((acc, cur) => acc + cur.length, 0);
  const out = new arr[0].constructor(l);
  let i = 0;
  for (let a of arr) {
    for (let j = 0; j < a.length; j++) {
      out[i] = a[j];
      i++;
    }
  }
  return out;
};

},

// ../v2-account-migrator/ts-client-library/packages/account-system/src/dag.ts @42
42: function(__fusereq, exports, module){
exports.__esModule = true;
var uint_1 = __fusereq(43);
class CyclicReferenceError extends Error {
  constructor(id, stack) {
    super(`DAG: Cyclic reference detected ${id} in ${JSON.stringify(stack)}`);
  }
}
exports.CyclicReferenceError = CyclicReferenceError;
class BinarySerializationError extends Error {
  constructor(why, data) {
    super(`DAG: Invalid binary ${data} because of "${why}"`);
  }
}
exports.BinarySerializationError = BinarySerializationError;
class VertexExistsError extends Error {
  constructor(id) {
    super(`DAG: Vertex id ${id} already exists in dag`);
  }
}
exports.VertexExistsError = VertexExistsError;
class EdgeExistsError extends Error {
  constructor(edge) {
    super(`DAG: Edge already exists ${edge.child} -> ${edge.parent}`);
  }
}
exports.EdgeExistsError = EdgeExistsError;
class VertexNotFoundError extends Error {
  constructor(id, stack) {
    super(`DAG: Vertex ${id} not found in in ${JSON.stringify(stack)}`);
  }
}
exports.VertexNotFoundError = VertexNotFoundError;
var DAGBinaryTypes;
(function (DAGBinaryTypes) {
  DAGBinaryTypes[DAGBinaryTypes["DAG"] = 0] = "DAG"
  DAGBinaryTypes[DAGBinaryTypes["VERTEX"] = 1] = "VERTEX"
  DAGBinaryTypes[DAGBinaryTypes["EDGE"] = 2] = "EDGE"
})(DAGBinaryTypes || (DAGBinaryTypes = {}))
var DAGDigestTypes;
(function (DAGDigestTypes) {
  DAGDigestTypes[DAGDigestTypes["LEAF"] = 0] = "LEAF"
  DAGDigestTypes[DAGDigestTypes["BRANCH"] = 1] = "BRANCH"
})(DAGDigestTypes || (DAGDigestTypes = {}))
const checkLength = (b, actual) => {
  if (actual > b.length) {
    throw new BinarySerializationError("invalid length", b);
  }
};
class DAG {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.sinks = [];
  }
  static fromBinary(b) {
    const d = new DAG();
    let i = 0;
    checkLength(b, i + 1);
    const type = b[0];
    i += 1;
    if (type != DAGBinaryTypes.DAG) {
      throw new BinarySerializationError(`invalid type, expected ${DAGBinaryTypes.DAG}, got ${type}`, b);
    }
    checkLength(b, i + 4);
    const nodesLength = uint_1.readUInt32BE(b, i);
    i += 4;
    for (let n = 0; n < nodesLength; n++) {
      checkLength(b, i + 4);
      const l = uint_1.readUInt32BE(b, i);
      i += 4;
      checkLength(b, i + l);
      const nbin = b.slice(i, i + l);
      i += l;
      d.add(DAGVertex.fromBinary(nbin));
    }
    checkLength(b, i + 4);
    const edgesLength = uint_1.readUInt32BE(b, i);
    i += 4;
    for (let e = 0; e < edgesLength; e++) {
      checkLength(b, i + 4);
      const l = uint_1.readUInt32BE(b, i);
      i += 4;
      checkLength(b, i + l);
      const ebin = b.slice(i, i + l);
      i += l;
      d.addEdge(DAGEdge.fromBinary(ebin));
    }
    return d;
  }
  get binary() {
    return new Uint8Array([].concat(Array.from(uint_1.uint32ToUint8BE(this.nodes.length)), this.nodes.map(node => Array.from(uint_1.uint32ToUint8BE(node.binary.length)).concat(Array.from(node.binary))).flat(), Array.from(uint_1.uint32ToUint8BE(this.edges.length)), this.edges.map(edge => Array.from(uint_1.uint32ToUint8BE(edge.binary.length)).concat(Array.from(edge.binary))).flat()));
  }
  clone() {
    return DAG.fromBinary(this.binary);
  }
  add(node) {
    if (this.nodes.find(({id}) => id == node.id)) {
      console.warn(new VertexExistsError(node.id));
      return;
    }
    this.nodes.push(node);
    this.sinks.push(node.id);
  }
  addReduced(node) {
    for (let sink of this.sinks.slice()) {
      this.addEdge(new DAGEdge(node.id, sink));
    }
    this.add(node);
  }
  addEdge(edge) {
    if (this.edges.find(({child, parent}) => child == edge.child && parent == edge.parent)) {
      console.warn(new EdgeExistsError(edge));
      return;
    }
    this.edges.push(edge);
    try {
      this.dependencies(edge.child);
    } catch (err) {
      this.edges.pop();
      throw err;
    }
    const sinkIndex = this.sinks.findIndex(sink => sink == edge.parent);
    if (sinkIndex != -1) {
      this.sinks.splice(sinkIndex, 1);
    }
  }
  parentEdges(id) {
    return this.edges.filter(({child}) => child == id);
  }
  depth(id) {
    const parents = this.parentEdges(id).map(({parent}) => parent).sort((a, b) => a - b);
    if (parents.length) {
      return 1 + Math.max.apply(undefined, parents.map(to => this.depth(to)));
    }
    return 0;
  }
  dependencies(id, seen = []) {
    if (seen.includes(id)) {
      throw new CyclicReferenceError(id, seen);
    }
    const parents = this.parentEdges(id).map(({parent}) => parent).sort((a, b) => a - b);
    const newSeen = [].concat(seen, [id]);
    return [].concat(parents, parents.map(to => this.dependencies(to, newSeen)).flat());
  }
  async digest(id, hash) {
    if (!id) {
      const parents = this.sinks.sort((a, b) => a - b);
      const hashes = await Promise.all(parents.map(async parent => [DAGDigestTypes.BRANCH].concat(Array.from(await this.digest(parent, hash)))));
      const data = new Uint8Array([].concat(...hashes));
      return hash(data);
    }
    const node = this.nodes.find(node => id == node.id);
    if (!node) {
      throw new VertexNotFoundError(id, this.nodes);
    }
    const leaf = [DAGDigestTypes.LEAF].concat(Array.from(await hash(node.binary)));
    const parents = this.parentEdges(id).map(({parent}) => parent).sort((a, b) => a - b);
    if (!parents.length) {
      return hash(new Uint8Array(leaf));
    }
    const branches = await Promise.all(parents.map(async parent => [DAGDigestTypes.BRANCH].concat(Array.from(await this.digest(parent, hash)))));
    const data = new Uint8Array([].concat(Array.from(leaf), branches.flat()));
    return hash(data);
  }
}
exports.DAG = DAG;
class DAGEdge {
  static fromBinary(b) {
    let i = 0;
    checkLength(b, i);
    const type = b[i];
    i += 1;
    if (type != DAGBinaryTypes.EDGE) {
      throw new BinarySerializationError(`invalid type, expected ${DAGBinaryTypes.EDGE}, got ${type}`, b);
    }
    checkLength(b, i + 4);
    const from = uint_1.readUInt32BE(b, i);
    i += 4;
    checkLength(b, i + 4);
    const to = uint_1.readUInt32BE(b, i);
    i += 4;
    return new DAGEdge(from, to);
  }
  get binary() {
    return new Uint8Array([].concat([DAGBinaryTypes.EDGE], Array.from(uint_1.uint32ToUint8BE(this.child)), Array.from(uint_1.uint32ToUint8BE(this.parent))));
  }
  constructor(child, parent) {
    this.child = child;
    this.parent = parent;
  }
}
exports.DAGEdge = DAGEdge;
class DAGVertex {
  static fromBinary(b) {
    let i = 0;
    checkLength(b, i);
    const type = b[i];
    i += 1;
    if (type != DAGBinaryTypes.VERTEX) {
      throw new BinarySerializationError(`invalid type, expected ${DAGBinaryTypes.VERTEX}, got ${type}`, b);
    }
    checkLength(b, i + 4);
    const id = uint_1.readUInt32BE(b, i);
    i += 4;
    checkLength(b, i + 4);
    const dataLength = uint_1.readUInt32BE(b, i);
    i += 4;
    checkLength(b, i + dataLength);
    const data = b.slice(i, i + dataLength);
    i += dataLength;
    if (i != b.length) {
      throw new BinarySerializationError("invalid length", b);
    }
    const node = new DAGVertex(data);
    node.id = id;
    return node;
  }
  get binary() {
    return new Uint8Array([].concat([DAGBinaryTypes.VERTEX], Array.from(uint_1.uint32ToUint8BE(this.id)), Array.from(uint_1.uint32ToUint8BE(this.data.length)), Array.from(this.data)));
  }
  constructor(data) {
    this.id = Math.floor(Math.random() * (2 ** 32 - 1)) + 1;
    this.data = data;
  }
}
exports.DAGVertex = DAGVertex;

},

// ../v2-account-migrator/ts-client-library/packages/util/src/uint.ts @43
43: function(__fusereq, exports, module){
exports.__esModule = true;
exports.readUInt32BE = (arr, offset) => {
  return arr.slice(offset, offset + 4).reduce((acc, n, i) => acc + n * 2 ** ((3 - i) * 8), 0);
};
exports.uint32ToUint8BE = n => {
  return new Uint8Array([((n & 0xff000000) >> 24) + 0x0100 & 0xff, (n & 0x00ff0000) >> 16, (n & 0x0000ff00) >> 8, n & 0x000000ff]);
};
exports.uint16ToUint8BE = n => {
  return new Uint8Array([(n & 0xff00) >> 8, n & 0x00ff]);
};

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/downloadFile.ts @67
67: function(__fusereq, exports, module){
exports.__esModule = true;
var download_1 = __fusereq(192);
var download_1d = __fuse.dt(download_1);
const downloadFile = (masterHandle, handle) => {
  return new download_1d.default(handle, masterHandle.downloadOpts);
};
exports.downloadFile = downloadFile;

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/generateSubHDKey.ts @68
68: function(__fusereq, exports, module){
exports.__esModule = true;
var hashing_1 = __fusereq(193);
var hashToPath_1 = __fusereq(26);
const generateSubHDKey = (masterHandle, pathString) => {
  const path = hashToPath_1.hashToPath(hashing_1.hash(pathString), {
    prefix: true
  });
  return masterHandle.derive(path);
};
exports.generateSubHDKey = generateSubHDKey;

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/getAccountInfo.ts @69
69: function(__fusereq, exports, module){
exports.__esModule = true;
var checkPaymentStatus_1 = __fusereq(194);
const getAccountInfo = async masterHandle => (await checkPaymentStatus_1.checkPaymentStatus(masterHandle.uploadOpts.endpoint, masterHandle)).data.account;
exports.getAccountInfo = getAccountInfo;

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/getFolderHDKey.ts @70
70: function(__fusereq, exports, module){
exports.__esModule = true;
var generateSubHDKey_1 = __fusereq(68);
var cleanPath_1 = __fusereq(195);
const getFolderHDKey = (masterHandle, dir) => {
  dir = cleanPath_1.cleanPath(dir);
  return generateSubHDKey_1.generateSubHDKey(masterHandle, "folder: " + dir);
};
exports.getFolderHDKey = getFolderHDKey;

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/getFolderLocation.ts @71
71: function(__fusereq, exports, module){
exports.__esModule = true;
var hashing_1 = __fusereq(193);
var cleanPath_1 = __fusereq(195);
const getFolderLocation = (masterHandle, dir) => {
  dir = cleanPath_1.cleanPath(dir);
  return hashing_1.hash(masterHandle.getFolderHDKey(dir).publicKey.toString("hex"));
};
exports.getFolderLocation = getFolderLocation;

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/getHandle.ts @72
72: function(__fusereq, exports, module){
exports.__esModule = true;
const getHandle = masterHandle => {
  return masterHandle.privateKey.toString("hex") + masterHandle.chainCode.toString("hex");
};
exports.getHandle = getHandle;

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/isPaid.ts @73
73: function(__fusereq, exports, module){
exports.__esModule = true;
var checkPaymentStatus_1 = __fusereq(194);
const isPaid = async masterHandle => {
  try {
    const accountInfoResponse = await checkPaymentStatus_1.checkPaymentStatus(masterHandle.uploadOpts.endpoint, masterHandle);
    return accountInfoResponse.data.paymentStatus == "paid";
  } catch {
    return false;
  }
};
exports.isPaid = isPaid;

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/register.ts @74
74: function(__fusereq, exports, module){
exports.__esModule = true;
var checkPaymentStatus_1 = __fusereq(194);
var createAccount_1 = __fusereq(196);
const register = async (masterHandle, duration, limit) => {
  if (await masterHandle.isPaid()) {
    return {
      data: {
        invoice: {
          cost: 0,
          ethAddress: "0x0"
        }
      },
      waitForPayment: async () => ({
        data: (await checkPaymentStatus_1.checkPaymentStatus(masterHandle.uploadOpts.endpoint, masterHandle)).data
      })
    };
  }
  const createAccountResponse = await createAccount_1.createAccount(masterHandle.uploadOpts.endpoint, masterHandle, masterHandle.getFolderLocation("/"), duration, limit);
  return {
    data: createAccountResponse.data,
    waitForPayment: () => new Promise(resolve => {
      const interval = setInterval(async () => {
        const time = Date.now();
        if ((await masterHandle.isPaid()) && time + 5 * 1000 > Date.now()) {
          clearInterval(interval);
          await masterHandle.login();
          resolve({
            data: (await checkPaymentStatus_1.checkPaymentStatus(masterHandle.uploadOpts.endpoint, masterHandle)).data
          });
        }
      }, 10 * 1000);
    })
  };
};
exports.register = register;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/buildFullTree.ts @75
75: function(__fusereq, exports, module){
exports.__esModule = true;
var getFolderMeta_1 = __fusereq(83);
var path_browserify_1 = __fusereq(203);
var cleanPath_1 = __fusereq(195);
const buildFullTree = async (masterHandle, dir = "/") => {
  dir = cleanPath_1.cleanPath(dir);
  const tree = {};
  tree[dir] = await getFolderMeta_1.getFolderMeta(masterHandle, dir);
  await Promise.all(tree[dir].folders.map(async folder => {
    Object.assign(tree, await buildFullTree(masterHandle, path_browserify_1.posix.join(dir, folder.name)));
  }));
  return tree;
};
exports.buildFullTree = buildFullTree;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/createFolder.ts @76
76: function(__fusereq, exports, module){
exports.__esModule = true;
var folder_entry_1 = __fusereq(211);
var folder_meta_1 = __fusereq(208);
var createMetaQueue_1 = __fusereq(78);
var path_browserify_1 = __fusereq(203);
var cleanPath_1 = __fusereq(195);
const createFolderFn = async (masterHandle, dir, name) => {
  const fullDir = path_browserify_1.posix.join(dir, name);
  if (name.indexOf("/") > 0 || name.length > 2 ** 8) throw new Error("Invalid folder name");
  if (!(await masterHandle.getFolderMeta(dir).catch(console.warn))) await createFolder(masterHandle, path_browserify_1.posix.dirname(dir), path_browserify_1.posix.basename(dir));
  if (await masterHandle.getFolderMeta(fullDir).catch(console.warn)) throw new Error("Folder already exists");
  await masterHandle.createFolderMeta(fullDir).catch(console.warn);
  await masterHandle.setFolderMeta(fullDir, new folder_meta_1.FolderMeta({
    name
  }));
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  masterHandle.metaQueue[dir].push({
    type: "add-folder",
    payload: new folder_entry_1.FolderEntryMeta({
      name,
      location: masterHandle.getFolderLocation(fullDir)
    })
  });
};
const createFolder = async (masterHandle, dir, name) => {
  dir = cleanPath_1.cleanPath(dir);
  const fullDir = path_browserify_1.posix.join(dir, name);
  if (masterHandle.metaFolderCreating[fullDir]) {
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (!masterHandle.metaFolderCreating[fullDir]) {
          resolve();
          clearInterval(interval);
        }
      }, 250);
    });
    return;
  }
  masterHandle.metaFolderCreating[fullDir] = true;
  await createFolderFn(masterHandle, dir, name);
  masterHandle.metaFolderCreating[fullDir] = false;
};
exports.createFolder = createFolder;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/createFolderMeta.ts @77
77: function(__fusereq, exports, module){
exports.__esModule = true;
var metadata_1 = __fusereq(204);
var cleanPath_1 = __fusereq(195);
const createFolderMeta = async (masterHandle, dir) => {
  dir = cleanPath_1.cleanPath(dir);
  try {
    await metadata_1.createMetadata(masterHandle.uploadOpts.endpoint, masterHandle, masterHandle.getFolderLocation(dir));
  } catch (err) {
    console.error(`Can't create folder metadata for folder ${dir}`);
    throw err;
  }
};
exports.createFolderMeta = createFolderMeta;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/createMetaQueue.ts @78
78: function(__fusereq, exports, module){
exports.__esModule = true;
var netQueue_1 = __fusereq(197);
var getFolderMeta_1 = __fusereq(83);
var setFolderMeta_1 = __fusereq(91);
var removeFile_1 = __fusereq(198);
var removeVersion_1 = __fusereq(199);
var addFile_1 = __fusereq(200);
var addFolder_1 = __fusereq(201);
var removeFolder_1 = __fusereq(202);
var cleanPath_1 = __fusereq(195);
const createMetaQueue = (masterHandle, dir) => {
  dir = cleanPath_1.cleanPath(dir);
  if (masterHandle.metaQueue[dir]) return;
  const metaQueue = new netQueue_1.NetQueue({
    fetch: async () => {
      return getFolderMeta_1.getFolderMeta(masterHandle, dir);
    },
    update: async meta => {
      await setFolderMeta_1.setFolderMeta(masterHandle, dir, meta);
    }
  });
  const types = [{
    type: "add-folder",
    action: addFolder_1.addFolder
  }, {
    type: "add-file",
    action: addFile_1.addFile
  }, {
    type: "remove-folder",
    action: removeFolder_1.removeFolder
  }, {
    type: "remove-file",
    action: removeFile_1.removeFile
  }, {
    type: "remove-version",
    action: removeVersion_1.removeVersion
  }];
  for (let type of types) {
    metaQueue.addType({
      type: type.type,
      handler: async (meta, payload) => {
        return await type.action(metaQueue, meta, payload);
      }
    });
  }
  masterHandle.metaQueue[dir] = metaQueue;
};
exports.createMetaQueue = createMetaQueue;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/deleteFile.ts @79
79: function(__fusereq, exports, module){
exports.__esModule = true;
var getFolderMeta_1 = __fusereq(83);
var deleteVersion_1 = __fusereq(82);
var createMetaQueue_1 = __fusereq(78);
var cleanPath_1 = __fusereq(195);
const deleteFile = async (masterHandle, dir, file) => {
  dir = cleanPath_1.cleanPath(dir);
  const meta = await getFolderMeta_1.getFolderMeta(masterHandle, dir);
  const existingFile = meta.files.find(f => file === f || file.name === f.name);
  if (!existingFile) return;
  for (let version of existingFile.versions) {
    await deleteVersion_1.deleteVersion(masterHandle, dir, version);
  }
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  masterHandle.metaQueue[dir].push({
    type: "remove-file",
    payload: existingFile
  });
};
exports.deleteFile = deleteFile;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/deleteFolder.ts @80
80: function(__fusereq, exports, module){
exports.__esModule = true;
var createMetaQueue_1 = __fusereq(78);
var path_browserify_1 = __fusereq(203);
var cleanPath_1 = __fusereq(195);
const deleteFolder = async (masterHandle, dir, folder) => {
  dir = cleanPath_1.cleanPath(dir);
  const fullDir = path_browserify_1.posix.join(dir, folder.name);
  if (folder.name.indexOf("/") > 0 || folder.name.length > 2 ** 8) throw new Error("Invalid folder name");
  const meta = await masterHandle.getFolderMeta(fullDir).catch(console.warn);
  if (meta) {
    await Promise.all([(async () => {
      try {
        for (let folder of meta.folders) {
          await masterHandle.deleteFolder(fullDir, folder);
        }
      } catch (err) {
        console.error("Failed to delete sub folders");
        throw err;
      }
    })(), (async () => {
      try {
        for (let file of meta.files) {
          await masterHandle.deleteFile(fullDir, file);
        }
      } catch (err) {
        console.error("Failed to delete file");
        throw err;
      }
    })()]);
  }
  try {
    await masterHandle.deleteFolderMeta(fullDir);
  } catch (err) {
    console.error("Failed to delete meta entry");
    throw err;
  }
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  masterHandle.metaQueue[dir].push({
    type: "remove-folder",
    payload: folder
  });
};
exports.deleteFolder = deleteFolder;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/deleteFolderMeta.ts @81
81: function(__fusereq, exports, module){
exports.__esModule = true;
var metadata_1 = __fusereq(204);
var cleanPath_1 = __fusereq(195);
const deleteFolderMeta = async (masterHandle, dir) => {
  dir = cleanPath_1.cleanPath(dir);
  await metadata_1.deleteMetadata(masterHandle.uploadOpts.endpoint, masterHandle, masterHandle.getFolderLocation(dir));
};
exports.deleteFolderMeta = deleteFolderMeta;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/deleteVersion.ts @82
82: function(__fusereq, exports, module){
exports.__esModule = true;
var deleteFile_1 = __fusereq(205);
var createMetaQueue_1 = __fusereq(78);
var cleanPath_1 = __fusereq(195);
const deleteVersion = async (masterHandle, dir, version) => {
  dir = cleanPath_1.cleanPath(dir);
  await deleteFile_1.deleteFile(masterHandle.uploadOpts.endpoint, masterHandle, version.handle.slice(0, 64)).catch(err => {
    console.warn("version does not exist");
    console.warn(err);
  });
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  masterHandle.metaQueue[dir].push({
    type: "remove-version",
    payload: version
  });
};
exports.deleteVersion = deleteVersion;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/getFolderMeta.ts @83
83: function(__fusereq, exports, module){
var buffer = __fusereq(17);
var Buffer = buffer;
exports.__esModule = true;
var node_forge_1 = __fusereq(206);
var hashing_1 = __fusereq(193);
var metadata_1 = __fusereq(204);
var encryption_1 = __fusereq(207);
var folder_meta_1 = __fusereq(208);
var createMetaQueue_1 = __fusereq(78);
var cleanPath_1 = __fusereq(195);
const getFolderMeta = async (masterHandle, dir) => {
  dir = cleanPath_1.cleanPath(dir);
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  const folderKey = masterHandle.getFolderHDKey(dir), location = masterHandle.getFolderLocation(dir), key = hashing_1.hash(folderKey.privateKey.toString("hex")), response = await metadata_1.getMetadata(masterHandle.uploadOpts.endpoint, masterHandle, location);
  try {
    const metaString = encryption_1.decrypt(key, new node_forge_1.util.ByteBuffer(Buffer.from(response.data.metadata, "base64"))).toString();
    try {
      const meta = JSON.parse(metaString);
      return new folder_meta_1.MinifiedFolderMeta(meta).unminify();
    } catch (err) {
      console.error(err);
      console.info("META STRING:", metaString);
      throw new Error("metadata corrupted");
    }
  } catch (err) {
    console.error(err);
    throw new Error("error decrypting meta");
  }
};
exports.getFolderMeta = getFolderMeta;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/isExpired.ts @84
84: function(__fusereq, exports, module){
exports.__esModule = true;
var checkPaymentStatus_1 = __fusereq(194);
const isExpired = async masterHandle => {
  try {
    const accountInfoResponse = await checkPaymentStatus_1.checkPaymentStatus(masterHandle.uploadOpts.endpoint, masterHandle);
    return accountInfoResponse.data.paymentStatus == "expired";
  } catch {
    return false;
  }
};
exports.isExpired = isExpired;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/login.ts @85
85: function(__fusereq, exports, module){
exports.__esModule = true;
var folder_meta_1 = __fusereq(208);
var index_1 = __fusereq(209);
const login = async masterHandle => {
  if (!(await index_1.isPaid(masterHandle))) {
    return;
  }
  try {
    await masterHandle.getFolderMeta("/");
  } catch (err) {
    try {
      const meta = await index_1.getFolderMeta(masterHandle, "/");
      await masterHandle.deleteFolderMeta("/").catch(console.warn);
      await masterHandle.createFolderMeta("/").catch(console.warn);
      console.info("--- META ---", meta);
      await masterHandle.setFolderMeta("/", new folder_meta_1.FolderMeta(meta));
    } catch (err) {
      console.warn(err);
      await masterHandle.createFolderMeta("/").catch(console.warn);
      await masterHandle.setFolderMeta("/", new folder_meta_1.FolderMeta());
    }
  }
};
exports.login = login;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/moveFile.ts @86
86: function(__fusereq, exports, module){
exports.__esModule = true;
var getFolderMeta_1 = __fusereq(83);
var createMetaQueue_1 = __fusereq(78);
var cleanPath_1 = __fusereq(195);
const moveFile = async (masterHandle, dir, {file, to}) => {
  dir = cleanPath_1.cleanPath(dir);
  const meta = await getFolderMeta_1.getFolderMeta(masterHandle, dir).catch(console.warn), toMeta = await getFolderMeta_1.getFolderMeta(masterHandle, to).catch(console.warn);
  if (!meta) throw new Error("Folder does not exist");
  if (!toMeta) throw new Error("Can't move to folder that doesn't exist");
  const existingFile = meta.files.find(f => file === f || file.name === f.name);
  if (!existingFile) throw new Error("File no longer exists");
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  createMetaQueue_1.createMetaQueue(masterHandle, to);
  masterHandle.metaQueue[dir].push({
    type: "remove-file",
    payload: existingFile
  });
  masterHandle.metaQueue[to].push({
    type: "add-file",
    payload: existingFile
  });
};
exports.moveFile = moveFile;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/moveFolder.ts @87
87: function(__fusereq, exports, module){
exports.__esModule = true;
var getFolderMeta_1 = __fusereq(83);
var setFolderMeta_1 = __fusereq(91);
var deleteFolderMeta_1 = __fusereq(81);
var createMetaQueue_1 = __fusereq(78);
var createFolderMeta_1 = __fusereq(77);
var path_browserify_1 = __fusereq(203);
var cleanPath_1 = __fusereq(195);
const moveFolder = async (masterHandle, dir, {folder, to}) => {
  dir = cleanPath_1.cleanPath(dir);
  const oldDir = path_browserify_1.posix.join(dir, folder.name), newDir = path_browserify_1.posix.join(to, folder.name);
  const folderMeta = await getFolderMeta_1.getFolderMeta(masterHandle, oldDir).catch(console.warn), outerMeta = await getFolderMeta_1.getFolderMeta(masterHandle, dir).catch(console.warn), toMeta = await getFolderMeta_1.getFolderMeta(masterHandle, to).catch(console.warn);
  if (!folderMeta) throw new Error("Folder does not exist");
  if (!outerMeta) throw new Error("Outer folder does not exist");
  if (!toMeta) throw new Error("Can't move to folder that doesn't exist");
  if (await getFolderMeta_1.getFolderMeta(masterHandle, newDir).catch(console.warn)) throw new Error("Folder already exists");
  const existingFolder = outerMeta.folders.find(f => folder === f || folder.name === f.name);
  if (!existingFolder) throw new Error("File no longer exists");
  await createFolderMeta_1.createFolderMeta(masterHandle, newDir).catch(console.warn);
  await setFolderMeta_1.setFolderMeta(masterHandle, newDir, await getFolderMeta_1.getFolderMeta(masterHandle, oldDir));
  await deleteFolderMeta_1.deleteFolderMeta(masterHandle, oldDir);
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  createMetaQueue_1.createMetaQueue(masterHandle, to);
  masterHandle.metaQueue[dir].push({
    type: "remove-folder",
    payload: existingFolder
  });
  masterHandle.metaQueue[to].push({
    type: "add-folder",
    payload: existingFolder
  });
};
exports.moveFolder = moveFolder;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/renameFile.ts @88
88: function(__fusereq, exports, module){
exports.__esModule = true;
var getFolderMeta_1 = __fusereq(83);
var file_entry_1 = __fusereq(210);
var createMetaQueue_1 = __fusereq(78);
var cleanPath_1 = __fusereq(195);
const renameFile = async (masterHandle, dir, {file, name}) => {
  dir = cleanPath_1.cleanPath(dir);
  const meta = await getFolderMeta_1.getFolderMeta(masterHandle, dir).catch(console.warn);
  if (!meta) throw new Error("Folder does not exist");
  const existingFile = meta.files.find(f => file === f || file.name === f.name);
  if (!existingFile) throw new Error("File no longer exists");
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  masterHandle.metaQueue[dir].push({
    type: "remove-file",
    payload: existingFile
  });
  masterHandle.metaQueue[dir].push({
    type: "add-file",
    payload: new file_entry_1.FileEntryMeta({
      ...existingFile,
      name
    })
  });
};
exports.renameFile = renameFile;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/renameFolder.ts @89
89: function(__fusereq, exports, module){
exports.__esModule = true;
var getFolderMeta_1 = __fusereq(83);
var setFolderMeta_1 = __fusereq(91);
var deleteFolderMeta_1 = __fusereq(81);
var index_1 = __fusereq(27);
var folder_entry_1 = __fusereq(211);
var createMetaQueue_1 = __fusereq(78);
var createFolder_1 = __fusereq(76);
var path_browserify_1 = __fusereq(203);
var cleanPath_1 = __fusereq(195);
const renameFolder = async (masterHandle, dir, {folder, name}) => {
  dir = cleanPath_1.cleanPath(dir);
  if (name.indexOf("/") > 0 || name.length > 2 ** 8) throw new Error("Invalid folder name");
  const oldDir = path_browserify_1.posix.join(dir, folder.name), newDir = path_browserify_1.posix.join(dir, name);
  const folderMeta = await getFolderMeta_1.getFolderMeta(masterHandle, dir).catch(console.warn), meta = await getFolderMeta_1.getFolderMeta(masterHandle, dir).catch(console.warn);
  if (!folderMeta) throw new Error("Folder does not exist");
  if (!meta) throw new Error("Outer folder does not exist");
  if (await getFolderMeta_1.getFolderMeta(masterHandle, newDir).catch(console.warn)) throw new Error("Folder already exists");
  const existingFolder = meta.folders.find(f => folder === f || folder.name === f.name);
  if (!existingFolder) throw new Error("Folder no longer exists");
  await createFolder_1.createFolder(masterHandle, dir, name);
  await setFolderMeta_1.setFolderMeta(masterHandle, newDir, await getFolderMeta_1.getFolderMeta(masterHandle, oldDir));
  await deleteFolderMeta_1.deleteFolderMeta(masterHandle, oldDir);
  createMetaQueue_1.createMetaQueue(masterHandle, dir);
  masterHandle.metaQueue[dir].push({
    type: "remove-folder",
    payload: existingFolder
  });
  masterHandle.metaQueue[dir].push({
    type: "add-folder",
    payload: new folder_entry_1.FolderEntryMeta({
      name,
      location: index_1.getFolderLocation(masterHandle, newDir)
    })
  });
};
exports.renameFolder = renameFolder;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/renewAccount.ts @90
90: function(__fusereq, exports, module){
exports.__esModule = true;
var renewAccount_1 = __fusereq(213);
var buildFullTree_1 = __fusereq(75);
var getFolderLocation_1 = __fusereq(71);
const renewAccount = async (masterHandle, duration) => {
  const tree = await buildFullTree_1.buildFullTree(masterHandle, "/");
  const metadataKeys = Object.keys(tree).map(dir => getFolderLocation_1.getFolderLocation(masterHandle, dir));
  const fileHandles = Object.values(tree).map(folder => folder.files.map(file => file.versions.map(version => version.handle.slice(0, 64)))).flat(2);
  console.log(metadataKeys, fileHandles);
  const renewAccountInvoiceResponse = await renewAccount_1.renewAccountInvoice(masterHandle.uploadOpts.endpoint, masterHandle, duration);
  console.log(renewAccountInvoiceResponse);
  const renewAccountStatusOpts = [masterHandle.uploadOpts.endpoint, masterHandle, metadataKeys, fileHandles, duration];
  return {
    data: renewAccountInvoiceResponse.data,
    waitForPayment: () => new Promise(resolve => {
      const interval = setInterval(async () => {
        const time = Date.now();
        const renewAccountStatusResponse = await renewAccount_1.renewAccountStatus(...renewAccountStatusOpts);
        console.log(renewAccountStatusResponse);
        if (renewAccountStatusResponse.data.status && renewAccountStatusResponse.data.status !== "Incomplete" && time + 5 * 1000 > Date.now()) {
          clearInterval(interval);
          await masterHandle.login();
          resolve({
            data: renewAccountStatusResponse.data
          });
        }
      }, 10 * 1000);
    })
  };
};
exports.renewAccount = renewAccount;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/setFolderMeta.ts @91
91: function(__fusereq, exports, module){
var buffer = __fusereq(17);
var Buffer = buffer;
exports.__esModule = true;
var hashing_1 = __fusereq(193);
var encryption_1 = __fusereq(207);
var metadata_1 = __fusereq(204);
var cleanPath_1 = __fusereq(195);
const setFolderMeta = async (masterHandle, dir, folderMeta) => {
  dir = cleanPath_1.cleanPath(dir);
  const folderKey = masterHandle.getFolderHDKey(dir), key = hashing_1.hash(folderKey.privateKey.toString("hex")), metaString = JSON.stringify(folderMeta.minify()), encryptedMeta = Buffer.from(encryption_1.encryptString(key, metaString, "utf8").toHex(), "hex").toString("base64");
  await metadata_1.setMetadata(masterHandle.uploadOpts.endpoint, masterHandle, masterHandle.getFolderLocation(dir), encryptedMeta);
};
exports.setFolderMeta = setFolderMeta;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/upgradeAccount.ts @92
92: function(__fusereq, exports, module){
exports.__esModule = true;
var upgradeAccount_1 = __fusereq(212);
var buildFullTree_1 = __fusereq(75);
var getFolderLocation_1 = __fusereq(71);
const upgradeAccount = async (masterHandle, duration, limit) => {
  const tree = await buildFullTree_1.buildFullTree(masterHandle, "/");
  const metadataKeys = Object.keys(tree).map(dir => getFolderLocation_1.getFolderLocation(masterHandle, dir));
  const fileHandles = Object.values(tree).map(folder => folder.files.map(file => file.versions.map(version => version.handle.slice(0, 64)))).flat(2);
  console.log(metadataKeys, fileHandles);
  const upgradeAccountInvoiceResponse = await upgradeAccount_1.upgradeAccountInvoice(masterHandle.uploadOpts.endpoint, masterHandle, duration, limit);
  console.log(upgradeAccountInvoiceResponse);
  const upgradeAccountStatusOpts = [masterHandle.uploadOpts.endpoint, masterHandle, metadataKeys, fileHandles, duration, limit];
  return {
    data: upgradeAccountInvoiceResponse.data,
    waitForPayment: () => new Promise(resolve => {
      const interval = setInterval(async () => {
        const time = Date.now();
        const upgradeAccountStatusResponse = await upgradeAccount_1.upgradeAccountStatus(...upgradeAccountStatusOpts);
        console.log(upgradeAccountStatusResponse);
        if (upgradeAccountStatusResponse.data.status && upgradeAccountStatusResponse.data.status !== "Incomplete" && time + 5 * 1000 > Date.now()) {
          clearInterval(interval);
          await masterHandle.login();
          resolve({
            data: upgradeAccountStatusResponse.data
          });
        }
      }, 10 * 1000);
    })
  };
};
exports.upgradeAccount = upgradeAccount;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/uploadFile.ts @93
93: function(__fusereq, exports, module){
exports.__esModule = true;
var events_1 = __fusereq(161);
var upload_1 = __fusereq(214);
var upload_1d = __fuse.dt(upload_1);
var file_entry_1 = __fusereq(210);
var file_version_1 = __fusereq(215);
var createMetaQueue_1 = __fusereq(78);
var getFolderMeta_1 = __fusereq(83);
var createFolder_1 = __fusereq(76);
var path_browserify_1 = __fusereq(203);
var cleanPath_1 = __fusereq(195);
const uploadFile = (masterHandle, dir, file) => {
  dir = cleanPath_1.cleanPath(dir);
  const upload = new upload_1d.default(file, masterHandle, masterHandle.uploadOpts), ee = new events_1.EventEmitter();
  Object.assign(ee, {
    handle: upload.handle
  });
  upload.on("upload-progress", progress => {
    ee.emit("upload-progress", progress);
  });
  upload.on("error", err => {
    ee.emit("error", err);
  });
  upload.on("finish", async finishedUpload => {
    if (!(await getFolderMeta_1.getFolderMeta(masterHandle, dir).catch(console.warn))) await createFolder_1.createFolder(masterHandle, path_browserify_1.posix.dirname(dir), path_browserify_1.posix.basename(dir));
    createMetaQueue_1.createMetaQueue(masterHandle, dir);
    masterHandle.metaQueue[dir].push({
      type: "add-file",
      payload: new file_entry_1.FileEntryMeta({
        name: file.name,
        modified: file.lastModified,
        versions: [new file_version_1.FileVersion({
          handle: finishedUpload.handle,
          size: file.size,
          modified: file.lastModified
        })]
      })
    });
    masterHandle.metaQueue[dir].once("update", meta => {
      ee.emit("finish", finishedUpload);
    });
  });
  return ee;
};
exports.uploadFile = uploadFile;

},

// ../v2-account-migrator/ts-client-library/packages/middleware/src/index.ts @102
102: function(__fusereq, exports, module){
},

// ../v2-account-migrator/ts-client-library/packages/util/src/derive.ts @103
103: function(__fusereq, exports, module){
exports.__esModule = true;
var path_browserify_1 = __fusereq(113);
var js_sha3_1 = __fusereq(32);
exports.pathHash = path => {
  path = path_browserify_1.posix.normalize(path);
  let node = new Uint8Array(32);
  if (path) {
    var labels = path.split("/");
    for (var i = 0; i < labels.length; i++) {
      var labelSha = new Uint8Array(js_sha3_1.keccak_256.arrayBuffer(labels[i]));
      node = new Uint8Array(js_sha3_1.keccak_256.arrayBuffer(new Uint8Array(Array.from(node).concat(Array.from(labelSha)))));
    }
  }
  return node;
};
exports.hashToPath = hash => {
  if (hash.length % 2) {
    throw new Error("hash length must be multiple of two bytes");
  }
  return "" + new Uint16Array(hash.buffer, hash.byteOffset, hash.byteLength / Uint16Array.BYTES_PER_ELEMENT).join("'/") + "'";
};
exports.nameHash = name => {
  return exports.pathHash(name.split(".").reverse().join("/"));
};

},

// ../v2-account-migrator/opaque/src/download.ts @192
192: function(__fusereq, exports, module){
var buffer = __fusereq(17);
var process = __fusereq(11);
var Buffer = buffer;
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var events_1 = __fusereq(161);
var metadata_1 = __fusereq(322);
var helpers_1 = __fusereq(323);
var decryptStream_1 = __fusereq(324);
var decryptStream_1d = __fuse.dt(decryptStream_1);
var downloadStream_1 = __fusereq(325);
var downloadStream_1d = __fuse.dt(downloadStream_1);
const METADATA_PATH = "/download/metadata/";
const DEFAULT_OPTIONS = Object.freeze({
  autoStart: true
});
class Download extends events_1.EventEmitter {
  constructor(handle, opts = {}) {
    super();
    this.metadata = async () => {
      if (this._metadata) {
        return this._metadata;
      } else {
        return await this.downloadMetadata();
      }
    };
    this.toBuffer = async () => {
      const chunks = [];
      let totalLength = 0;
      if (typeof Buffer === "undefined") {
        return false;
      }
      await this.startDownload();
      return new Promise(resolve => {
        this.decryptStream.on("data", data => {
          chunks.push(data);
          totalLength += data.length;
        });
        this.decryptStream.once("finish", () => {
          resolve(Buffer.concat(chunks, totalLength));
        });
      }).catch(err => {
        throw err;
      });
    };
    this.toFile = async () => {
      const chunks = [];
      let totalLength = 0;
      await this.startDownload();
      return new Promise(resolve => {
        this.decryptStream.on("data", data => {
          chunks.push(data);
          totalLength += data.length;
        });
        this.decryptStream.once("finish", async () => {
          const meta = await this.metadata();
          resolve(new File(chunks, meta.name, {
            type: helpers_1.getMimeType(meta)
          }));
        });
      }).catch(err => {
        throw err;
      });
    };
    this.startDownload = async () => {
      try {
        await this.getDownloadURL();
        await this.downloadMetadata();
        await this.downloadFile();
      } catch (e) {
        this.propagateError(e);
      }
    };
    this.getDownloadURL = async (overwrite = false) => {
      let req;
      if (!overwrite && this.downloadURLRequest) {
        req = this.downloadURLRequest;
      } else {
        req = axios_1d.default.post(this.options.endpoint + "/api/v1/download", {
          fileID: this.hash
        });
        this.downloadURLRequest = req;
      }
      const res = await req;
      if (res.status === 200) {
        this.downloadURL = res.data.fileDownloadUrl;
        return this.downloadURL;
      }
    };
    this.downloadMetadata = async (overwrite = false) => {
      let req;
      if (!this.downloadURL) {
        await this.getDownloadURL();
      }
      if (!overwrite && this.metadataRequest) {
        req = this.metadataRequest;
      } else {
        const endpoint = this.options.endpoint;
        const path = METADATA_PATH + this.hash;
        req = axios_1d.default.get(this.downloadURL + "/metadata", {
          responseType: "arraybuffer"
        });
        this.metadataRequest = req;
      }
      const res = await req;
      const metadata = metadata_1.decryptMetadata(new Uint8Array(res.data), this.key);
      this._metadata = metadata;
      this.size = helpers_1.getUploadSize(metadata.size, metadata.p || ({}));
      return metadata;
    };
    this.downloadFile = async () => {
      if (this.isDownloading) {
        return true;
      }
      this.isDownloading = true;
      this.downloadStream = new downloadStream_1d.default(this.downloadURL, await this.metadata, this.size, this.options);
      this.decryptStream = new decryptStream_1d.default(this.key);
      this.downloadStream.on("progress", progress => {
        this.emit("download-progress", {
          target: this,
          handle: this.handle,
          progress: progress
        });
      });
      this.downloadStream.pipe(this.decryptStream);
      this.downloadStream.on("error", this.propagateError);
      this.decryptStream.on("error", this.propagateError);
    };
    this.finishDownload = error => {
      if (error) {
        this.propagateError(error);
      } else {
        this.emit("finish");
      }
    };
    this.propagateError = error => {
      console.warn("Download error: ", error.message || error);
      process.nextTick(() => this.emit("error", error.message || error));
    };
    const options = Object.assign({}, DEFAULT_OPTIONS, opts);
    const {hash, key} = helpers_1.keysFromHandle(handle);
    this.options = options;
    this.handle = handle;
    this.hash = hash;
    this.key = key;
    this.downloadURLRequest = null;
    this.metadataRequest = null;
    this.isDownloading = false;
    if (options.autoStart) {
      this.startDownload();
    }
  }
}
exports.default = Download;

},

// ../v2-account-migrator/opaque/src/core/hashing.ts @193
193: function(__fusereq, exports, module){
exports.__esModule = true;
var web3_utils_1 = __fusereq(326);
exports.hash = (...val) => {
  return web3_utils_1.soliditySha3(...val).replace(/^0x/, "");
};

},

// ../v2-account-migrator/opaque/src/core/requests/checkPaymentStatus.ts @194
194: function(__fusereq, exports, module){
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var request_1 = __fusereq(327);
async function checkPaymentStatus(endpoint, hdNode) {
  const payload = {
    timestamp: Math.floor(Date.now() / 1000)
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/account-data", signedPayload);
}
exports.checkPaymentStatus = checkPaymentStatus;

},

// ../v2-account-migrator/opaque/src/utils/cleanPath.ts @195
195: function(__fusereq, exports, module){
exports.__esModule = true;
var path_browserify_1 = __fusereq(203);
const posixSep = new RegExp(path_browserify_1.posix.sep + "+", "g");
const posixSepEnd = new RegExp("(.)" + path_browserify_1.posix.sep + "+$");
const win32Sep = new RegExp("\\+", "g");
const trimTrailingSep = path => {
  return path.replace(posixSepEnd, "$1");
};
const cleanPath = path => {
  return trimTrailingSep(path.replace(win32Sep, path_browserify_1.posix.sep).replace(posixSep, path_browserify_1.posix.sep));
};
exports.cleanPath = cleanPath;

},

// ../v2-account-migrator/opaque/src/core/requests/createAccount.ts @196
196: function(__fusereq, exports, module){
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var request_1 = __fusereq(327);
async function createAccount(endpoint, hdNode, metadataKey, duration = 12, limit = 128) {
  const payload = {
    metadataKey: metadataKey,
    durationInMonths: duration,
    storageLimit: limit
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/accounts", signedPayload);
}
exports.createAccount = createAccount;

},

// ../v2-account-migrator/opaque/src/utils/netQueue.ts @197
197: function(__fusereq, exports, module){
exports.__esModule = true;
var events_1 = __fusereq(161);
var debounce_1 = __fusereq(328);
var debounce_1d = __fuse.dt(debounce_1);
class NetQueue extends events_1.EventEmitter {
  constructor({fetch, update, data = {}, timeout = 1000}) {
    super();
    this.updating = false;
    this.queue = [];
    this.types = {};
    this.data = {};
    this.push = ({type, payload}) => {
      this.queue.push({
        type,
        payload
      });
      this._process();
    };
    this.addType = ({type, handler}) => {
      this.types[type] = handler;
    };
    this._process = debounce_1d.default(async () => {
      if (this.updating) return;
      this.updating = true;
      const queueCopy = Object.assign([], this.queue);
      this.result = await Promise.resolve(this._fetch());
      for (let {type, payload} of queueCopy) {
        if (this.types[type]) this.result = await Promise.resolve(this.types[type](this.result, payload)); else throw new Error("unknown type: " + type);
        this.queue.shift();
      }
      await Promise.resolve(this._update(this.result));
      this.updating = false;
      this.emit("update", this.result);
      if (this.queue.length) this._process();
    }, this._timeout);
    this._fetch = fetch;
    this._update = update;
    this.data = data;
    this._timeout = timeout;
  }
}
exports.NetQueue = NetQueue;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/meta/removeFile.ts @198
198: function(__fusereq, exports, module){
exports.__esModule = true;
const removeFile = async (metaQueue, meta, file) => {
  if (!meta.files.find(f => file === f || file.name === f.name)) return meta;
  meta.files = meta.files.filter(f => file !== f && file.name !== f.name);
  return meta;
};
exports.removeFile = removeFile;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/meta/removeVersion.ts @199
199: function(__fusereq, exports, module){
exports.__esModule = true;
const removeVersion = async (metaQueue, meta, version) => {
  const file = meta.files.find(f => f.versions.includes(version) || !!f.versions.find(v => version.handle === v.handle));
  if (!file) return meta;
  file.versions = file.versions.filter(v => version !== v && version.handle !== v.handle);
  if (file.versions.length === 0) metaQueue.push({
    type: "remove-file",
    payload: file
  });
  return meta;
};
exports.removeVersion = removeVersion;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/meta/addFile.ts @200
200: function(__fusereq, exports, module){
exports.__esModule = true;
const addFile = (metaQueue, meta, file) => {
  const existingFile = meta.files.find(f => file === f || file.name === f.name);
  if (existingFile) {
    existingFile.modified = file.modified;
    existingFile.versions = [...existingFile.versions, ...file.versions];
  } else {
    meta.files.push(file);
  }
  return meta;
};
exports.addFile = addFile;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/meta/addFolder.ts @201
201: function(__fusereq, exports, module){
exports.__esModule = true;
const addFolder = (metaQueue, meta, folder) => {
  const existingFolder = meta.folders.find(f => folder === f || folder.name === f.name);
  if (!existingFolder) meta.folders.push(folder);
  return meta;
};
exports.addFolder = addFolder;

},

// ../v2-account-migrator/opaque/src/core/account/api/v1/meta/removeFolder.ts @202
202: function(__fusereq, exports, module){
exports.__esModule = true;
const removeFolder = async (metaQueue, meta, folder) => {
  if (!meta.folders.find(f => folder === f || folder.name === f.name)) return meta;
  meta.folders = meta.folders.filter(f => folder !== f && folder.name !== f.name);
  return meta;
};
exports.removeFolder = removeFolder;

},

// ../v2-account-migrator/opaque/src/core/requests/metadata.ts @204
204: function(__fusereq, exports, module){
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var request_1 = __fusereq(327);
async function createMetadata(endpoint, hdNode, metadataKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    timestamp,
    metadataKey
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/metadata/create", signedPayload);
}
exports.createMetadata = createMetadata;
async function deleteMetadata(endpoint, hdNode, metadataKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    timestamp,
    metadataKey
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/metadata/delete", signedPayload);
}
exports.deleteMetadata = deleteMetadata;
async function setMetadata(endpoint, hdNode, metadataKey, metadata) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    timestamp,
    metadata,
    metadataKey
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/metadata/set", signedPayload);
}
exports.setMetadata = setMetadata;
async function getMetadata(endpoint, hdNode, metadataKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    timestamp,
    metadataKey
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/metadata/get", signedPayload);
}
exports.getMetadata = getMetadata;

},

// ../v2-account-migrator/opaque/src/core/requests/deleteFile.ts @205
205: function(__fusereq, exports, module){
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var request_1 = __fusereq(327);
async function deleteFile(endpoint, hdNode, fileID) {
  const payload = {
    fileID
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/delete", signedPayload);
}
exports.deleteFile = deleteFile;

},

// ../v2-account-migrator/opaque/src/core/encryption.ts @207
207: function(__fusereq, exports, module){
var buffer = __fusereq(17);
exports.__esModule = true;
var Buffer = buffer;
var node_forge_1 = __fusereq(206);
var constants_1 = __fusereq(357);
const Forge = {
  cipher: node_forge_1.cipher,
  md: node_forge_1.md,
  util: node_forge_1.util,
  random: node_forge_1.random
};
const ByteBuffer = Forge.util.ByteBuffer;
function encrypt(key, byteBuffer) {
  const keyBuf = new ByteBuffer(Buffer.from(key, "hex"));
  const iv = Forge.random.getBytesSync(constants_1.IV_BYTE_LENGTH);
  const cipher = Forge.cipher.createCipher("AES-GCM", keyBuf);
  cipher.start({
    iv,
    tagLength: constants_1.TAG_BIT_LENGTH
  });
  cipher.update(byteBuffer);
  cipher.finish();
  byteBuffer.clear();
  byteBuffer.putBuffer(cipher.output);
  byteBuffer.putBuffer(cipher.mode.tag);
  byteBuffer.putBytes(iv);
  return byteBuffer;
}
exports.encrypt = encrypt;
function encryptString(key, string, encoding = "utf8") {
  const buf = Forge.util.createBuffer(string, encoding);
  return encrypt(key, buf);
}
exports.encryptString = encryptString;
function encryptBytes(key, bytes) {
  return encrypt(key, Forge.util.createBuffer(bytes));
}
exports.encryptBytes = encryptBytes;
function decrypt(key, byteBuffer) {
  const keyBuf = new ByteBuffer(Buffer.from(key, "hex"));
  keyBuf.read = 0;
  byteBuffer.read = byteBuffer.length() - constants_1.BLOCK_OVERHEAD;
  const tag = byteBuffer.getBytes(constants_1.TAG_BYTE_LENGTH);
  const iv = byteBuffer.getBytes(constants_1.IV_BYTE_LENGTH);
  const decipher = Forge.cipher.createDecipher("AES-GCM", keyBuf);
  byteBuffer.read = 0;
  byteBuffer.truncate(constants_1.BLOCK_OVERHEAD);
  decipher.start({
    iv,
    tag: tag,
    tagLength: constants_1.TAG_BIT_LENGTH
  });
  decipher.update(byteBuffer);
  if (decipher.finish()) {
    return decipher.output;
  } else {
    return false;
  }
}
exports.decrypt = decrypt;
function decryptBytes(key, bytes) {
  const buf = new ByteBuffer(bytes);
  const output = decrypt(key, buf);
  if (output) {
    return Forge.util.binary.raw.decode(output.getBytes());
  } else {
    return false;
  }
}
exports.decryptBytes = decryptBytes;
function decryptString(key, byteBuffer, encoding = "utf8") {
  const output = decrypt(key, byteBuffer);
  if (output) {
    return Buffer.from(output.toString()).toString(encoding);
  } else {
    throw new Error("unable to decrypt");
  }
}
exports.decryptString = decryptString;

},

// ../v2-account-migrator/opaque/src/core/account/folder-meta.ts @208
208: function(__fusereq, exports, module){
exports.__esModule = true;
var file_entry_1 = __fusereq(210);
var folder_entry_1 = __fusereq(211);
class FolderMeta {
  constructor({name = "Folder", files = [], folders = [], created = Date.now(), modified = Date.now()} = {}) {
    this.minify = () => new MinifiedFolderMeta([this.name, this.files.map(file => new file_entry_1.FileEntryMeta(file).minify()), this.folders.map(folder => new folder_entry_1.FolderEntryMeta(folder).minify()), this.created, this.modified]);
    this.name = name;
    this.files = files;
    this.folders = folders;
    this.created = created;
    this.modified = modified;
  }
}
class MinifiedFolderMeta extends Array {
  constructor([name, files, folders, created, modified]) {
    super(5);
    this.unminify = () => new FolderMeta({
      name: this[0],
      files: this[1].map(file => new file_entry_1.MinifiedFileEntryMeta(file).unminify()),
      folders: this[2].map(folder => new folder_entry_1.MinifiedFolderEntryMeta(folder).unminify()),
      created: this[3],
      modified: this[4]
    });
    this[0] = name;
    this[1] = files;
    this[2] = folders;
    this[3] = created;
    this[4] = modified;
  }
}
exports.FolderMeta = FolderMeta;
exports.MinifiedFolderMeta = MinifiedFolderMeta;

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/index.ts @209
209: function(__fusereq, exports, module){
exports.__esModule = true;
var downloadFile_1 = __fusereq(67);
var generateSubHDKey_1 = __fusereq(68);
var getAccountInfo_1 = __fusereq(69);
var getFolderHDKey_1 = __fusereq(70);
var getFolderLocation_1 = __fusereq(71);
var getFolderMeta_1 = __fusereq(358);
var getHandle_1 = __fusereq(72);
var isPaid_1 = __fusereq(73);
var register_1 = __fusereq(74);
exports.downloadFile = downloadFile_1.downloadFile;
exports.generateSubHDKey = generateSubHDKey_1.generateSubHDKey;
exports.getAccountInfo = getAccountInfo_1.getAccountInfo;
exports.getFolderHDKey = getFolderHDKey_1.getFolderHDKey;
exports.getFolderLocation = getFolderLocation_1.getFolderLocation;
exports.getFolderMeta = getFolderMeta_1.getFolderMeta;
exports.getHandle = getHandle_1.getHandle;
exports.isPaid = isPaid_1.isPaid;
exports.register = register_1.register;
const v0 = {
  downloadFile: downloadFile_1.downloadFile,
  generateSubHDKey: generateSubHDKey_1.generateSubHDKey,
  getAccountInfo: getAccountInfo_1.getAccountInfo,
  getFolderHDKey: getFolderHDKey_1.getFolderHDKey,
  getFolderLocation: getFolderLocation_1.getFolderLocation,
  getFolderMeta: getFolderMeta_1.getFolderMeta,
  getHandle: getHandle_1.getHandle,
  isPaid: isPaid_1.isPaid,
  register: register_1.register
};
exports.default = v0;

},

// ../v2-account-migrator/opaque/src/core/account/file-entry.ts @210
210: function(__fusereq, exports, module){
exports.__esModule = true;
var file_version_1 = __fusereq(215);
class FileEntryMeta {
  constructor({name, created = Date.now(), modified = Date.now(), versions = []}) {
    this.minify = () => new MinifiedFileEntryMeta([this.name, this.created, this.modified, this.versions.map(version => new file_version_1.FileVersion(version).minify())]);
    this.name = name;
    this.created = created;
    this.modified = modified;
    this.versions = versions;
  }
}
class MinifiedFileEntryMeta extends Array {
  constructor([name, created, modified, versions]) {
    super(4);
    this.unminify = () => new FileEntryMeta({
      name: this[0],
      created: this[1],
      modified: this[2],
      versions: this[3].map(version => new file_version_1.MinifiedFileVersion(version).unminify())
    });
    this[0] = name;
    this[1] = created;
    this[2] = modified;
    this[3] = versions;
  }
}
exports.FileEntryMeta = FileEntryMeta;
exports.MinifiedFileEntryMeta = MinifiedFileEntryMeta;

},

// ../v2-account-migrator/opaque/src/core/account/folder-entry.ts @211
211: function(__fusereq, exports, module){
exports.__esModule = true;
class FolderEntryMeta {
  constructor({name, location}) {
    this.minify = () => new MinifiedFolderEntryMeta([this.name, this.location]);
    this.name = name;
    this.location = location;
  }
}
class MinifiedFolderEntryMeta extends Array {
  constructor([name, location]) {
    super(2);
    this.unminify = () => new FolderEntryMeta({
      name: this[0],
      location: this[1]
    });
    this[0] = name;
    this[1] = location;
  }
}
exports.FolderEntryMeta = FolderEntryMeta;
exports.MinifiedFolderEntryMeta = MinifiedFolderEntryMeta;

},

// ../v2-account-migrator/opaque/src/core/requests/upgradeAccount.ts @212
212: function(__fusereq, exports, module){
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var request_1 = __fusereq(327);
async function upgradeAccountStatus(endpoint, hdNode, metadataKeys, fileHandles, duration = 12, limit = 128) {
  const payload = {
    metadataKeys,
    fileHandles,
    durationInMonths: duration,
    storageLimit: limit
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/upgrade", signedPayload);
}
exports.upgradeAccountStatus = upgradeAccountStatus;
async function upgradeAccountInvoice(endpoint, hdNode, duration = 12, limit = 128) {
  const payload = {
    durationInMonths: duration,
    storageLimit: limit
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/upgrade/invoice", signedPayload);
}
exports.upgradeAccountInvoice = upgradeAccountInvoice;

},

// ../v2-account-migrator/opaque/src/core/requests/renewAccount.ts @213
213: function(__fusereq, exports, module){
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var request_1 = __fusereq(327);
async function renewAccountStatus(endpoint, hdNode, metadataKeys, fileHandles, duration = 12) {
  const payload = {
    metadataKeys,
    fileHandles,
    durationInMonths: duration
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/renew", signedPayload);
}
exports.renewAccountStatus = renewAccountStatus;
async function renewAccountInvoice(endpoint, hdNode, duration = 12) {
  const payload = {
    durationInMonths: duration
  };
  const signedPayload = request_1.getPayload(payload, hdNode);
  return axios_1d.default.post(endpoint + "/api/v1/renew/invoice", signedPayload);
}
exports.renewAccountInvoice = renewAccountInvoice;

},

// ../v2-account-migrator/opaque/src/upload.ts @214
214: function(__fusereq, exports, module){
var process = __fusereq(11);
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var events_1 = __fusereq(161);
var metadata_1 = __fusereq(322);
var helpers_1 = __fusereq(323);
var encryptStream_1 = __fusereq(359);
var encryptStream_1d = __fuse.dt(encryptStream_1);
var uploadStream_1 = __fusereq(360);
var uploadStream_1d = __fuse.dt(uploadStream_1);
var request_1 = __fusereq(327);
const PART_MIN_SIZE = 1024 * 1024 * 5;
const POLYFILL_FORMDATA = typeof FormData === "undefined";
const DEFAULT_OPTIONS = Object.freeze({
  autoStart: true
});
const DEFAULT_FILE_PARAMS = {
  blockSize: 64 * 1024
};
class Upload extends events_1.EventEmitter {
  constructor(file, account, opts = {}) {
    super();
    this.startUpload = async () => {
      try {
        await this.uploadMetadata();
        await this.uploadFile();
      } catch (e) {
        this.propagateError(e);
      }
    };
    this.uploadMetadata = async () => {
      const meta = metadata_1.createMetadata(this.data, this.options.params);
      const encryptedMeta = metadata_1.encryptMetadata(meta, this.key);
      const data = request_1.getPayloadFD({
        fileHandle: this.hash,
        fileSizeInByte: this.uploadSize,
        endIndex: helpers_1.getEndIndex(this.uploadSize, this.options.params)
      }, {
        metadata: encryptedMeta
      }, this.account);
      const url = this.options.endpoint + "/api/v1/init-upload";
      const headers = data.getHeaders ? data.getHeaders() : {};
      const req = axios_1d.default.post(url, data, {
        headers
      });
      const res = await req;
      this.emit("metadata", meta);
    };
    this.uploadFile = async () => {
      const readStream = new this.data.reader(this.data, this.options.params);
      this.readStream = readStream;
      this.encryptStream = new encryptStream_1d.default(this.key, this.options.params);
      this.uploadStream = new uploadStream_1d.default(this.account, this.hash, this.uploadSize, this.options.endpoint, this.options.params);
      this.uploadStream.on("progress", progress => {
        this.emit("upload-progress", {
          target: this,
          handle: this.handle,
          progress
        });
      });
      this.readStream.pipe(this.encryptStream).pipe(this.uploadStream).on("finish", this.finishUpload);
      this.readStream.on("error", this.propagateError);
      this.encryptStream.on("error", this.propagateError);
      this.uploadStream.on("error", this.propagateError);
    };
    this.finishUpload = async () => {
      this.emit("finish", {
        target: this,
        handle: this.handle,
        metadata: this.metadata
      });
    };
    this.propagateError = error => {
      process.nextTick(() => this.emit("error", error));
    };
    const options = Object.assign({}, DEFAULT_OPTIONS, opts);
    options.params = Object.assign({}, DEFAULT_FILE_PARAMS, options.params || ({}));
    const {handle, hash, key} = helpers_1.generateFileKeys();
    const data = helpers_1.getFileData(file, handle);
    const size = helpers_1.getUploadSize(data.size, options.params);
    this.account = account;
    this.options = options;
    this.data = data;
    this.uploadSize = size;
    this.key = key;
    this.hash = hash;
    this.handle = handle;
    this.metadata = metadata_1.createMetadata(data, options.params);
    if (options.autoStart) {
      this.startUpload();
    }
  }
}
exports.default = Upload;

},

// ../v2-account-migrator/opaque/src/core/account/file-version.ts @215
215: function(__fusereq, exports, module){
exports.__esModule = true;
class FileVersion {
  constructor({handle, size, created = Date.now(), modified = Date.now()}) {
    this.minify = () => new MinifiedFileVersion([this.handle, this.size, this.created, this.modified]);
    this.handle = handle;
    this.size = size;
    this.created = created;
    this.modified = modified;
  }
}
class MinifiedFileVersion extends Array {
  constructor([handle, size, created, modified]) {
    super(4);
    this.unminify = () => new FileVersion({
      handle: this[0],
      size: this[1],
      created: this[2],
      modified: this[3]
    });
    this[0] = handle;
    this[1] = size;
    this[2] = created;
    this[3] = modified;
  }
}
exports.FileVersion = FileVersion;
exports.MinifiedFileVersion = MinifiedFileVersion;

},

// ../v2-account-migrator/opaque/src/core/metadata.ts @322
322: function(__fusereq, exports, module){
exports.__esModule = true;
var helpers_1 = __fusereq(323);
var encryption_1 = __fusereq(207);
var node_forge_1 = __fusereq(206);
const Forge = {
  util: node_forge_1.util
};
const PROTOCOL_VERSION = 1;
function createMetadata(file, opts) {
  const filename = helpers_1.sanitizeFilename(file.name);
  const metadata = {
    name: filename,
    type: file.type,
    size: file.size,
    p: opts
  };
  return metadata;
}
exports.createMetadata = createMetadata;
function encryptMetadata(metadata, key) {
  const encryptedMeta = encryption_1.encryptString(key, JSON.stringify(metadata), "utf8");
  return Forge.util.binary.raw.decode(encryptedMeta.getBytes());
}
exports.encryptMetadata = encryptMetadata;
function decryptMetadata(data, key) {
  const byteStr = Forge.util.binary.raw.encode(data);
  const byteBuffer = new Forge.util.ByteBuffer(byteStr);
  const meta = JSON.parse(encryption_1.decryptString(key, byteBuffer));
  return meta;
}
exports.decryptMetadata = decryptMetadata;

},

// ../v2-account-migrator/opaque/src/core/helpers.ts @323
323: function(__fusereq, exports, module){
exports.__esModule = true;
var node_forge_1 = __fusereq(206);
var is_buffer_1 = __fusereq(449);
var is_buffer_1d = __fuse.dt(is_buffer_1);
var fileSourceStream_1 = __fusereq(450);
var fileSourceStream_1d = __fuse.dt(fileSourceStream_1);
var bufferSourceStream_1 = __fusereq(451);
var bufferSourceStream_1d = __fuse.dt(bufferSourceStream_1);
var lite_1 = __fusereq(452);
var lite_1d = __fuse.dt(lite_1);
var constants_1 = __fusereq(357);
const Forge = {
  md: node_forge_1.md,
  random: node_forge_1.random,
  util: node_forge_1.util
};
const ByteBuffer = Forge.util.ByteBuffer;
function generateFileKeys() {
  const hash = Forge.md.sha256.create().update(Forge.random.getBytesSync(32)).digest().toHex();
  const key = Forge.md.sha256.create().update(Forge.random.getBytesSync(32)).digest().toHex();
  const handle = hash + key;
  return {
    hash,
    key,
    handle
  };
}
exports.generateFileKeys = generateFileKeys;
function keysFromHandle(handle) {
  const bytes = Forge.util.binary.hex.decode(handle);
  const buf = new ByteBuffer(bytes);
  const hash = buf.getBytes(32);
  const key = buf.getBytes(32);
  return {
    hash: Forge.util.bytesToHex(hash),
    key: Forge.util.bytesToHex(key),
    handle
  };
}
exports.keysFromHandle = keysFromHandle;
function sanitizeFilename(filename) {
  if (filename.length > constants_1.FILENAME_MAX_LENGTH) {
    const l = constants_1.FILENAME_MAX_LENGTH / 2 - 2;
    const start = filename.substring(0, l);
    const end = filename.substring(filename.length - l);
    filename = start + "..." + end;
  }
  return filename;
}
exports.sanitizeFilename = sanitizeFilename;
function getFileData(file, nameFallback = "file") {
  if (is_buffer_1d.default(file)) {
    file = file;
    return {
      data: file,
      size: file.length,
      name: nameFallback,
      type: "application/octet-stream",
      reader: bufferSourceStream_1d.default
    };
  } else if (file && file.data && is_buffer_1d.default(file.data)) {
    file = file;
    return {
      data: file.data,
      size: file.data.length,
      name: file.name || nameFallback,
      type: file.type || lite_1d.default.getType(file.name) || "",
      reader: bufferSourceStream_1d.default
    };
  } else {
    file.reader = fileSourceStream_1d.default;
  }
  return file;
}
exports.getFileData = getFileData;
function getMimeType(metadata) {
  return metadata.type || lite_1d.default.getType(metadata.name) || "";
}
exports.getMimeType = getMimeType;
function getUploadSize(size, params) {
  const blockSize = params.blockSize || constants_1.DEFAULT_BLOCK_SIZE;
  const blockCount = Math.ceil(size / blockSize);
  return size + blockCount * constants_1.BLOCK_OVERHEAD;
}
exports.getUploadSize = getUploadSize;
function getEndIndex(uploadSize, params) {
  const blockSize = params.blockSize || constants_1.DEFAULT_BLOCK_SIZE;
  const partSize = params.partSize || constants_1.DEFAULT_PART_SIZE;
  const chunkSize = blockSize + constants_1.BLOCK_OVERHEAD;
  const chunkCount = Math.ceil(uploadSize / chunkSize);
  const chunksPerPart = Math.ceil(partSize / chunkSize);
  const endIndex = Math.ceil(chunkCount / chunksPerPart);
  return endIndex;
}
exports.getEndIndex = getEndIndex;
function getBlockSize(params) {
  if (params && params.blockSize) {
    return params.blockSize;
  } else if (params && params.p && params.p.blockSize) {
    return params.p.blockSize;
  } else {
    return constants_1.DEFAULT_BLOCK_SIZE;
  }
}
exports.getBlockSize = getBlockSize;

},

// ../v2-account-migrator/opaque/src/streams/decryptStream.ts @324
324: function(__fusereq, exports, module){
exports.__esModule = true;
var readable_stream_1 = __fusereq(453);
var encryption_1 = __fusereq(207);
var node_forge_1 = __fusereq(206);
var constants_1 = __fusereq(357);
var helpers_1 = __fusereq(323);
const Forge = {
  util: node_forge_1.util
};
const DEFAULT_OPTIONS = Object.freeze({
  binaryMode: false,
  objectMode: true,
  blockSize: constants_1.DEFAULT_BLOCK_SIZE
});
class DecryptStream extends readable_stream_1.Transform {
  constructor(key, options) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);
    super(opts);
    this.options = opts;
    this.key = key;
    this.iter = 0;
    this.blockSize = helpers_1.getBlockSize(options);
  }
  _transform(chunk, encoding, callback) {
    const blockSize = this.blockSize;
    const chunkSize = blockSize + constants_1.BLOCK_OVERHEAD;
    const length = chunk.length;
    for (let offset = 0; offset < length; offset += chunkSize) {
      const limit = Math.min(offset + chunkSize, length);
      const buf = chunk.slice(offset, limit);
      const data = encryption_1.decryptBytes(this.key, buf);
      if (data) {
        this.push(data);
      } else {
        this.emit("error", "Error decrypting data block");
      }
    }
    callback(null);
  }
}
exports.default = DecryptStream;

},

// ../v2-account-migrator/opaque/src/streams/downloadStream.ts @325
325: function(__fusereq, exports, module){
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var readable_stream_1 = __fusereq(453);
var helpers_1 = __fusereq(323);
var constants_1 = __fusereq(357);
const DEFAULT_OPTIONS = Object.freeze({
  autostart: true,
  maxParallelDownloads: 1,
  maxRetries: 0,
  partSize: 80 * (constants_1.DEFAULT_BLOCK_SIZE + constants_1.BLOCK_OVERHEAD),
  objectMode: false
});
class DownloadStream extends readable_stream_1.Readable {
  constructor(url, metadata, size, options = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);
    super(opts);
    this.options = opts;
    this.url = url;
    this.size = size;
    this.metadata = metadata;
    this.chunks = [];
    this.chunkId = 0;
    this.pushId = 0;
    this.bytesDownloaded = 0;
    this.isDownloadFinished = false;
    this.ongoingDownloads = 0;
    this.pushChunk = false;
    const blockSize = helpers_1.getBlockSize(metadata);
    const blockCount = opts.partSize / (blockSize + constants_1.BLOCK_OVERHEAD);
    if (blockCount !== Math.floor(blockCount)) {
      this.emit("error", "options.partSize must be a multiple of blockSize + blockOverhead");
    }
    if (opts.autostart) {
      this._download();
    }
  }
  _read() {
    this.pushChunk = true;
    const attemptDownload = this.ongoingDownloads < this.options.maxParallelDownloads;
    if (!this.isDownloadFinished && attemptDownload) {
      this._download();
    }
    this._pushChunk();
  }
  async _download(chunkIndex) {
    const size = this.size;
    const partSize = this.options.partSize;
    const index = chunkIndex || this.chunks.length;
    const offset = index * partSize;
    if (offset >= size) {
      this.isDownloadFinished = true;
      return;
    }
    const limit = Math.min(offset + partSize, size) - offset;
    const range = `bytes=${offset}-${offset + limit - 1}`;
    const chunk = {
      id: this.chunkId++,
      data: null,
      offset,
      limit
    };
    try {
      this.chunks.push(chunk);
      this.ongoingDownloads++;
      const download = await axios_1d.default.get(this.url + "/file", {
        responseType: "arraybuffer",
        headers: {
          range
        }
      });
      chunk.data = new Uint8Array(download.data);
      this.bytesDownloaded += chunk.data.length;
      this.ongoingDownloads--;
      this.emit("progress", this.bytesDownloaded / this.size);
      this._pushChunk();
    } catch (error) {
      this.ongoingDownloads--;
      this.emit("error", error);
    }
    return;
  }
  async _afterDownload() {}
  _pushChunk() {
    if (!this.pushChunk) {
      return;
    }
    const chunk = this.chunks[this.pushId];
    if (chunk && chunk.data !== null) {
      this.pushId++;
      this.pushChunk = this.push(chunk.data);
      chunk.data = null;
      this._pushChunk();
    } else if (this.ongoingDownloads === 0 && this.isDownloadFinished) {
      this.push(null);
    }
  }
}
exports.default = DownloadStream;

},

// ../v2-account-migrator/opaque/src/core/request.ts @327
327: function(__fusereq, exports, module){
var buffer = __fusereq(17);
var Buffer = buffer;
exports.__esModule = true;
var form_data_1 = __fusereq(483);
var form_data_1d = __fuse.dt(form_data_1);
var ethereumjs_util_1 = __fusereq(484);
const POLYFILL_FORMDATA = typeof FormData === "undefined";
function getPayload(rawPayload, hdNode, key = "requestBody") {
  const payload = JSON.stringify(rawPayload);
  const hash = ethereumjs_util_1.keccak256(payload);
  const signature = hdNode.sign(hash).toString("hex");
  const pubKey = hdNode.publicKey.toString("hex");
  const signedPayload = {
    signature,
    publicKey: pubKey,
    hash: hash.toString("hex")
  };
  signedPayload[key] = payload;
  return signedPayload;
}
exports.getPayload = getPayload;
function getPayloadFD(rawPayload, extraPayload, hdNode, key = "requestBody") {
  const payload = JSON.stringify(rawPayload);
  const hash = ethereumjs_util_1.keccak256(payload);
  const signature = hdNode.sign(hash).toString("hex");
  const pubKey = hdNode.publicKey.toString("hex");
  if (POLYFILL_FORMDATA) {
    const data = new form_data_1d.default();
    data.append(key, payload);
    data.append("signature", signature);
    data.append("publicKey", pubKey);
    if (extraPayload) {
      Object.keys(extraPayload).forEach(key => {
        const pl = Buffer.from(extraPayload[key]);
        data.append(key, pl, {
          filename: key,
          contentType: "application/octet-stream",
          knownLength: pl.length
        });
      });
    }
    return data;
  } else {
    const data = new FormData();
    data.append(key, payload);
    data.append("signature", signature);
    data.append("publicKey", pubKey);
    if (extraPayload) {
      Object.keys(extraPayload).forEach(key => {
        data.append(key, new Blob([extraPayload[key].buffer]), key);
      });
    }
    return data;
  }
}
exports.getPayloadFD = getPayloadFD;
var getPlans_1 = __fusereq(482);
exports.getPlans = getPlans_1.getPlans;
var checkPaymentStatus_1 = __fusereq(194);
exports.checkPaymentStatus = checkPaymentStatus_1.checkPaymentStatus;
var createAccount_1 = __fusereq(196);
exports.createAccount = createAccount_1.createAccount;
var metadata_1 = __fusereq(204);
exports.getMetadata = metadata_1.getMetadata;
exports.setMetadata = metadata_1.setMetadata;
exports.createMetadata = metadata_1.createMetadata;
exports.deleteMetadata = metadata_1.deleteMetadata;

},

// ../v2-account-migrator/opaque/src/core/constants.ts @357
357: function(__fusereq, exports, module){
exports.__esModule = true;
exports.FILENAME_MAX_LENGTH = 256;
exports.CURRENT_VERSION = 1;
exports.IV_BYTE_LENGTH = 16;
exports.TAG_BYTE_LENGTH = 16;
exports.TAG_BIT_LENGTH = exports.TAG_BYTE_LENGTH * 8;
exports.DEFAULT_BLOCK_SIZE = 64 * 1024;
exports.BLOCK_OVERHEAD = exports.TAG_BYTE_LENGTH + exports.IV_BYTE_LENGTH;
exports.DEFAULT_PART_SIZE = 128 * (exports.DEFAULT_BLOCK_SIZE + exports.BLOCK_OVERHEAD);

},

// ../v2-account-migrator/opaque/src/core/account/api/v0/getFolderMeta.ts @358
358: function(__fusereq, exports, module){
var buffer = __fusereq(17);
var Buffer = buffer;
exports.__esModule = true;
var node_forge_1 = __fusereq(206);
var hashing_1 = __fusereq(193);
var metadata_1 = __fusereq(204);
var encryption_1 = __fusereq(207);
var cleanPath_1 = __fusereq(195);
const getFolderMeta = async (masterHandle, dir) => {
  dir = cleanPath_1.cleanPath(dir);
  const folderKey = masterHandle.getFolderHDKey(dir), location = masterHandle.getFolderLocation(dir), key = hashing_1.hash(folderKey.privateKey.toString("hex")), response = await metadata_1.getMetadata(masterHandle.uploadOpts.endpoint, masterHandle, location);
  try {
    const metaString = encryption_1.decrypt(key, new node_forge_1.util.ByteBuffer(Buffer.from(response.data.metadata, "hex"))).toString();
    try {
      const meta = JSON.parse(metaString);
      return meta;
    } catch (err) {
      console.error(err);
      console.info("META STRING:", metaString);
      throw new Error("metadata corrupted");
    }
  } catch (err) {
    console.error(err);
    throw new Error("error decrypting meta");
  }
};
exports.getFolderMeta = getFolderMeta;

},

// ../v2-account-migrator/opaque/src/streams/encryptStream.ts @359
359: function(__fusereq, exports, module){
exports.__esModule = true;
var readable_stream_1 = __fusereq(453);
var encryption_1 = __fusereq(207);
var node_forge_1 = __fusereq(206);
const Forge = {
  util: node_forge_1.util
};
const DEFAULT_OPTIONS = Object.freeze({
  objectMode: false
});
class EncryptStream extends readable_stream_1.Transform {
  constructor(key, options) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);
    super(opts);
    this.options = opts;
    this.key = key;
  }
  _transform(data, encoding, callback) {
    const chunk = encryption_1.encryptBytes(this.key, data);
    const buf = Forge.util.binary.raw.decode(chunk.getBytes());
    this.push(buf);
    callback(null);
  }
}
exports.default = EncryptStream;

},

// ../v2-account-migrator/opaque/src/streams/uploadStream.ts @360
360: function(__fusereq, exports, module){
var process = __fusereq(11);
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
var readable_stream_1 = __fusereq(453);
var request_1 = __fusereq(327);
var helpers_1 = __fusereq(323);
var constants_1 = __fusereq(357);
const POLYFILL_FORMDATA = typeof FormData === "undefined";
const PART_MIME = "application/octet-stream";
const DEFAULT_OPTIONS = Object.freeze({
  maxParallelUploads: 3,
  maxRetries: 0,
  partSize: constants_1.DEFAULT_PART_SIZE,
  objectMode: false
});
class UploadStream extends readable_stream_1.Writable {
  constructor(account, hash, size, endpoint, options) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);
    super(opts);
    this.account = account;
    this.hash = hash;
    this.endpoint = endpoint;
    this.options = opts;
    this.size = size;
    this.endIndex = helpers_1.getEndIndex(size, opts);
    this.bytesUploaded = 0;
    this.blockBuffer = [];
    this.partBuffer = [];
    this.bufferSize = 0;
    this.ongoingUploads = 0;
    this.retries = 0;
    this.partIndex = 0;
    this.finalCallback = null;
  }
  _write(data, encoding, callback) {
    this.blockBuffer.push(data);
    this.bufferSize += data.length;
    if (this.bufferSize >= this.options.partSize) {
      this._addPart();
      this._attemptUpload();
    }
    callback();
  }
  _final(callback) {
    this.finalCallback = callback;
    if (this.blockBuffer.length > 0) {
      this._addPart();
      this._attemptUpload();
    } else if (this.ongoingUploads === 0) {
      this._finishUpload();
    }
  }
  _addPart() {
    const blocks = this.blockBuffer;
    const data = new Uint8Array(this.bufferSize);
    let offset = 0;
    do {
      const block = blocks.shift();
      data.set(block, offset);
      offset += block.length;
    } while (blocks.length > 0);
    this.partBuffer.push({
      partIndex: ++this.partIndex,
      data
    });
    this.blockBuffer = [];
    this.bufferSize = 0;
  }
  _attemptUpload() {
    if (this.ongoingUploads >= this.options.maxParallelUploads) {
      return;
    }
    const part = this.partBuffer.shift();
    this._upload(part);
  }
  _upload(part) {
    this.ongoingUploads++;
    if (this.ongoingUploads === this.options.maxParallelUploads) {
      this.cork();
    }
    const data = request_1.getPayloadFD({
      fileHandle: this.hash,
      partIndex: part.partIndex,
      endIndex: this.endIndex
    }, {
      chunkData: part.data
    }, this.account);
    const upload = axios_1d.default.post(this.endpoint + "/api/v1/upload", data, {
      headers: data.getHeaders ? data.getHeaders() : {},
      onUploadProgress: event => {
        return;
      }
    }).then(result => {
      this._afterUpload(part);
    }).catch(error => {
      this._uploadError(error, part);
    });
  }
  _afterUpload(part) {
    this.ongoingUploads--;
    this.bytesUploaded += part.data.length;
    this.emit("progress", this.bytesUploaded / this.size);
    if (this.partBuffer.length > 0) {
      return this._attemptUpload();
    }
    if (this.finalCallback) {
      if (this.ongoingUploads === 0) {
        this._finishUpload();
      }
    } else {
      process.nextTick(() => this.uncork());
    }
  }
  async _finishUpload() {
    const confirmUpload = this._confirmUpload.bind(this);
    const data = request_1.getPayload({
      fileHandle: this.hash
    }, this.account);
    let uploadFinished = false;
    do {
      uploadFinished = await confirmUpload(data);
      if (!uploadFinished) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } while (!uploadFinished);
    this.finalCallback();
  }
  async _confirmUpload(data) {
    try {
      const req = axios_1d.default.post(this.endpoint + "/api/v1/upload-status", data);
      const res = await req;
      if (!res.data.missingIndexes || !res.data.missingIndexes.length) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.warn(err.message || err);
      return false;
    }
  }
  _uploadError(error, part) {
    this.ongoingUploads--;
    console.warn("error", error);
    if (this.retries++ < this.options.maxRetries) {
      console.log("retrying", this.retries, "of", this.options.maxRetries);
      this.partBuffer.push(part);
      this._attemptUpload();
      return;
    }
    if (this.finalCallback) {
      this.finalCallback(error);
    } else {
      this.emit("error", error);
      this.end();
    }
  }
}
exports.default = UploadStream;

},

// ../v2-account-migrator/opaque/src/streams/fileSourceStream.ts @450
450: function(__fusereq, exports, module){
exports.__esModule = true;
var readable_stream_1 = __fusereq(453);
const DEFAULT_OPTIONS = Object.freeze({
  objectMode: false
});
class FileSourceStream extends readable_stream_1.Readable {
  constructor(blob, options) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);
    console.log("Starting file source stream", blob);
    super(opts);
    this.offset = 0;
    this.options = opts;
    this.blob = blob;
    this.reader = new FileReader();
    this._onChunkRead = this._onChunkRead.bind(this);
    if (opts.blockSize <= 0) {
      throw new Error(`Invalid blockSize '${opts.blockSize}' in source stream.`);
    }
  }
  _read() {
    if (this.reader.readyState !== FileReader.LOADING) {
      this._readChunkFromBlob();
    }
  }
  _readChunkFromBlob() {
    const blob = this.blob;
    const offset = this.offset;
    const blockSize = this.options.blockSize;
    const limit = Math.min(offset + blockSize, blob.size);
    if (offset >= blob.size) {
      return this.push(null);
    }
    const chunk = blob.slice(offset, limit, "application/octet-stream");
    this.offset += blockSize;
    this.reader.onload = this._onChunkRead;
    this.reader.readAsArrayBuffer(chunk);
  }
  _onChunkRead(event) {
    const chunk = event.target.result;
    if (this.push(new Uint8Array(chunk))) {
      this._read();
    }
  }
}
exports.default = FileSourceStream;

},

// ../v2-account-migrator/opaque/src/streams/bufferSourceStream.ts @451
451: function(__fusereq, exports, module){
exports.__esModule = true;
var readable_stream_1 = __fusereq(453);
const DEFAULT_OPTIONS = Object.freeze({
  objectMode: false
});
class BufferSourceStream extends readable_stream_1.Readable {
  constructor(data, options) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);
    super(opts);
    this.offset = 0;
    this.options = opts;
    this.buffer = data.data;
    if (opts.blockSize <= 0) {
      throw new Error(`Invalid blockSize '${opts.blockSize}' in source stream.`);
    }
  }
  _read() {
    let read;
    do {
      read = this.push(this._readChunkFromBuffer());
    } while (read);
  }
  _readChunkFromBuffer() {
    const buf = this.buffer;
    const offset = this.offset;
    const blockSize = this.options.blockSize;
    const limit = Math.min(offset + blockSize, buf.length) - offset;
    if (offset >= buf.length) {
      return null;
    }
    const slice = buf.slice(offset, offset + limit);
    this.offset += blockSize;
    return slice;
  }
}
exports.default = BufferSourceStream;

},

// ../v2-account-migrator/opaque/src/core/requests/getPlans.ts @482
482: function(__fusereq, exports, module){
exports.__esModule = true;
var axios_1 = __fusereq(321);
var axios_1d = __fuse.dt(axios_1);
async function getPlans(endpoint) {
  return axios_1d.default.get(endpoint + "/plans");
}
exports.getPlans = getPlans;

}
})
//# sourceMappingURL=app.js.map