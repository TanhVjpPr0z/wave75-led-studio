// Global W3C WebHID TypeScript declarations for strict mode

export {};

declare global {
  interface HIDDeviceFilter {
    vendorId?: number;
    productId?: number;
    usagePage?: number;
    usage?: number;
  }

  interface HIDDeviceRequestOptions {
    filters: HIDDeviceFilter[];
    exclusionFilters?: HIDDeviceFilter[];
  }

  interface HIDReportItem {
    isAbsolute?: boolean;
    isArray?: boolean;
    isBufferedBytes?: boolean;
    isConstant?: boolean;
    isLinear?: boolean;
    isRange?: boolean;
    isVolatile?: boolean;
    hasNull?: boolean;
    hasPreferredState?: boolean;
    wrap?: boolean;
    usages?: number[];
    usageMinimum?: number;
    usageMaximum?: number;
    reportSize?: number;
    reportCount?: number;
    unitExponent?: number;
    unitSystem?: string;
    logicalMinimum?: number;
    logicalMaximum?: number;
    physicalMinimum?: number;
    physicalMaximum?: number;
    strings?: string[];
  }

  interface HIDReportInfo {
    reportId: number;
    items: HIDReportItem[];
  }

  interface HIDCollectionInfo {
    usage: number;
    usagePage: number;
    type?: number;
    children: HIDCollectionInfo[];
    inputReports: HIDReportInfo[];
    outputReports: HIDReportInfo[];
    featureReports: HIDReportInfo[];
  }

  interface HIDInputReportEvent extends Event {
    readonly device: HIDDevice;
    readonly reportId: number;
    readonly data: DataView;
  }

  interface HIDConnectionEvent extends Event {
    readonly device: HIDDevice;
  }

  interface HIDDevice extends EventTarget {
    readonly opened: boolean;
    readonly vendorId: number;
    readonly productId: number;
    readonly productName: string;
    readonly collections: HIDCollectionInfo[];
    open(): Promise<void>;
    close(): Promise<void>;
    forget?(): Promise<void>;
    sendReport(reportId: number, data: BufferSource): Promise<void>;
    sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
    receiveFeatureReport(reportId: number): Promise<DataView>;
    oninputreport: ((this: HIDDevice, ev: HIDInputReportEvent) => unknown) | null;
  }

  interface HID extends EventTarget {
    getDevices(): Promise<HIDDevice[]>;
    requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>;
    onconnect: ((this: HID, ev: HIDConnectionEvent) => unknown) | null;
    ondisconnect: ((this: HID, ev: HIDConnectionEvent) => unknown) | null;
  }

  interface Navigator {
    readonly hid?: HID;
  }
}
