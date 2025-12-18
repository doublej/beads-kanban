<script lang="ts">
	import {
		// Navigation & UI
		Search, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
		Plus, SquarePlus, Minus, MoreHorizontal, MoreVertical, Menu,
		// Actions
		Check, Copy, Clipboard, Trash2, Edit3, Save, RefreshCw,
		ExternalLink, Link2, Unlink,
		// Status & Indicators
		Circle, CircleDot, CircleSlash, CheckCircle2, AlertCircle,
		Clock, Loader2, Zap,
		// Issue Types
		CheckSquare, Bug, Sparkles, Layers, Wrench,
		// Views
		LayoutGrid, GitBranch, Network, BarChart3,
		// Dependency Types
		Ban, ArrowLeftRight, CornerDownRight, Diamond,
		// Theme & Settings
		Sun, Moon, Settings, SlidersHorizontal, Filter,
		// Help & Info
		HelpCircle, Info, MessageSquare, Keyboard,
		// Project & Files
		Folder, FolderOpen, FileText,
		// Sorting & Organization
		ArrowUpDown, ArrowUp, ArrowDown, ListFilter,
		// Agents & AI
		Bot, Cpu, Activity,
		// Misc
		Send, Calendar, Tag, User, Users
	} from 'lucide-svelte';

	type IconName =
		// Navigation & UI
		| 'search' | 'close' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'chevron-up'
		| 'plus' | 'plus-square' | 'minus' | 'more-h' | 'more-v' | 'menu'
		// Actions
		| 'check' | 'copy' | 'clipboard' | 'trash' | 'edit' | 'save' | 'refresh'
		| 'external-link' | 'link' | 'unlink'
		// Status & Indicators
		| 'circle' | 'circle-dot' | 'circle-slash' | 'check-circle' | 'alert-circle'
		| 'clock' | 'loader' | 'zap'
		// Issue Types
		| 'task' | 'bug' | 'feature' | 'epic' | 'chore'
		// Views
		| 'view-board' | 'view-tree' | 'view-graph' | 'view-stats'
		// Dependency Types
		| 'dep-blocks' | 'dep-related' | 'dep-parent' | 'dep-discovered'
		// Theme & Settings
		| 'sun' | 'moon' | 'settings' | 'sliders' | 'filter'
		// Help & Info
		| 'help' | 'info' | 'message' | 'keyboard'
		// Project & Files
		| 'folder' | 'folder-open' | 'file'
		// Sorting & Organization
		| 'sort' | 'sort-asc' | 'sort-desc' | 'list-filter'
		// Agents & AI
		| 'agent' | 'cpu' | 'activity'
		// Misc
		| 'send' | 'calendar' | 'tag' | 'user' | 'users';

	interface Props {
		name: IconName;
		size?: number | string;
		strokeWidth?: number;
		class?: string;
	}

	let { name, size = 16, strokeWidth = 2, class: className = '' }: Props = $props();

	const icons: Record<IconName, typeof Search> = {
		// Navigation & UI
		'search': Search,
		'close': X,
		'chevron-left': ChevronLeft,
		'chevron-right': ChevronRight,
		'chevron-down': ChevronDown,
		'chevron-up': ChevronUp,
		'plus': Plus,
		'plus-square': SquarePlus,
		'minus': Minus,
		'more-h': MoreHorizontal,
		'more-v': MoreVertical,
		'menu': Menu,
		// Actions
		'check': Check,
		'copy': Copy,
		'clipboard': Clipboard,
		'trash': Trash2,
		'edit': Edit3,
		'save': Save,
		'refresh': RefreshCw,
		'external-link': ExternalLink,
		'link': Link2,
		'unlink': Unlink,
		// Status & Indicators
		'circle': Circle,
		'circle-dot': CircleDot,
		'circle-slash': CircleSlash,
		'check-circle': CheckCircle2,
		'alert-circle': AlertCircle,
		'clock': Clock,
		'loader': Loader2,
		'zap': Zap,
		// Issue Types
		'task': CheckSquare,
		'bug': Bug,
		'feature': Sparkles,
		'epic': Layers,
		'chore': Wrench,
		// Views
		'view-board': LayoutGrid,
		'view-tree': GitBranch,
		'view-graph': Network,
		'view-stats': BarChart3,
		// Dependency Types
		'dep-blocks': Ban,
		'dep-related': ArrowLeftRight,
		'dep-parent': CornerDownRight,
		'dep-discovered': Diamond,
		// Theme & Settings
		'sun': Sun,
		'moon': Moon,
		'settings': Settings,
		'sliders': SlidersHorizontal,
		'filter': Filter,
		// Help & Info
		'help': HelpCircle,
		'info': Info,
		'message': MessageSquare,
		'keyboard': Keyboard,
		// Project & Files
		'folder': Folder,
		'folder-open': FolderOpen,
		'file': FileText,
		// Sorting & Organization
		'sort': ArrowUpDown,
		'sort-asc': ArrowUp,
		'sort-desc': ArrowDown,
		'list-filter': ListFilter,
		// Agents & AI
		'agent': Bot,
		'cpu': Cpu,
		'activity': Activity,
		// Misc
		'send': Send,
		'calendar': Calendar,
		'tag': Tag,
		'user': User,
		'users': Users
	};

	const IconComponent = $derived(icons[name]);
</script>

{#if IconComponent}
	<IconComponent {size} {strokeWidth} class={className} />
{/if}
