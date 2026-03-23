import { FormEvent } from 'react';
import { AuditLogRecord } from '../../lib/auditTypes';
import { Location, Shift, Skill, Staff } from '../../lib/mockData';
import { ValidationResult } from '../../lib/schedulingRules';
import { ShiftCoverageGroup } from '../../lib/shiftCoverage';

export type SchedulingActor = {
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  locationIds?: string[];
};

export type ShiftPreview = {
  startUtc: string;
  endUtc: string;
  isOvernight: boolean;
  durationHours: number;
  locationDate: string;
  locationTimeRange: string;
  locationTimeZone: string;
  viewerDate: string;
  viewerTimeRange: string;
  viewerTimeZone: string;
};

export type OverrideRequest = {
  staff: Staff;
  shift: Shift;
  warnings: string[];
};

export type AssignmentConflictKind =
  | 'occupied'
  | 'availability'
  | 'compliance'
  | 'ineligible'
  | 'warning';

export type AssignmentConflictTone = 'rose' | 'amber' | 'slate';

export type AssignmentConflictClassification = {
  kind: AssignmentConflictKind;
  label: string;
  tone: AssignmentConflictTone;
};

export type SchedulingHeaderProps = {
  isConnected: boolean;
  lastSync: number;
  viewerTimeZone: string;
  onCreateShift: () => void;
};

export type SchedulingInsightsProps = {
  shifts: Shift[];
  staffList: Staff[];
  fairnessData: any;
  viewerTimeZone: string;
};

export type LocationWeekControlsProps = {
  availableLocations: Location[];
  selectedLocation: string;
  selectedWeekStart: string;
  cutoffInput: string;
  cutoffHours: number;
  savingCutoff: boolean;
  publishingWeek: null | 'publish' | 'unpublish';
  onSelectLocation: (locationId: string) => void;
  onChangeWeekStart: (value: string) => void;
  onMoveWeek: (direction: -1 | 1) => void;
  onCutoffInputChange: (value: string) => void;
  onSaveCutoff: () => void;
  onPublishWeek: (publish: boolean) => void;
};

export type CoverageHealthSectionProps = {
  coverageGroups: ShiftCoverageGroup[];
  onFocusGroup: (groupId: string) => void;
};

export type ShiftBoardProps = {
  coverageGroups: ShiftCoverageGroup[];
  viewerTimeZone: string;
  highlightedCoverageGroupId: string | null;
  publishingShiftId: string | null;
  onTogglePublish: (shiftId: string) => void;
  onOpenAssignment: (shift: Shift) => void;
  onOpenHistory: (shift: Shift) => void;
  onOpenEdit: (shift: Shift) => void;
};

export type ShiftAssignmentModalProps = {
  shift: Shift | null;
  viewerTimeZone: string;
  activeCoverageGroup: ShiftCoverageGroup | null;
  validationData: ValidationResult | null;
  staffList: Staff[];
  shifts: Shift[];
  assigningOperationKeys: string[];
  getAssignmentKey: (shiftId: string, staffId: string) => string;
  getUnassignKey: (shiftId: string) => string;
  classifyAssignmentConflict: (result: ValidationResult) => AssignmentConflictClassification;
  isWarnOnlyConflict: (result: ValidationResult) => boolean;
  onClose: () => void;
  onAttemptAssignment: (staff: Staff) => Promise<void>;
  onRemoveAssignment: (shift: Shift) => Promise<void>;
};

export type ShiftEditorModalProps = {
  isOpen: boolean;
  editingShift: Shift | null;
  availableLocations: Location[];
  activeDraftLocation: Location | null;
  startDateTime: Date | null;
  endDateTime: Date | null;
  planningMinDate: Date;
  skills: Skill[];
  newShiftLocation: string;
  newShiftSkill: string;
  newShiftHeadcount: number;
  newShiftSkipManagerApproval: boolean;
  cutoffHours: number;
  isOvernightDraft: boolean;
  shiftDateOrderInvalid: boolean;
  shiftPreview: ShiftPreview | null;
  creatingShift: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onChangeStartDateTime: (value: Date | null) => void;
  onChangeEndDateTime: (value: Date | null) => void;
  onChangeLocation: (value: string) => void;
  onChangeSkill: (value: string) => void;
  onChangeHeadcount: (value: number) => void;
  onChangeSkipManagerApproval: (value: boolean) => void;
};

export type ShiftAuditModalProps = {
  shift: Shift | null;
  viewerTimeZone: string;
  loading: boolean;
  logs: AuditLogRecord[];
  onClose: () => void;
};
