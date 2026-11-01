export type UserRole="customer"|"driver"|"admin"|"operations"|"support"|"finance";
export type DriverApprovalStatus="pending"|"approved"|"rejected"|"suspended";
export type DriverAvailability="offline"|"online"|"on_trip";
export type TripStatus="requested"|"searching"|"accepted"|"driver_arriving"|"driver_arrived"|"in_progress"|"completed"|"cancelled";
export type ServiceType="city"|"intercity"|"private"|"scheduled"|"parcel";
export interface GeoPoint{latitude:number;longitude:number}
export interface FareBreakdown{baseFare:number;distanceFare:number;waitingFare:number;platformFee:number;driverNet:number;total:number;currency:"EGP"}
export interface TripRequest{id:string;customerId:string;pickup:GeoPoint;destination:GeoPoint;serviceType:ServiceType;status:TripStatus;assignedDriverId?:string;fareEstimate?:FareBreakdown;createdAt:string}