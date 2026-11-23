import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'flame'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'scale'
  | 'camera'
  | 'pencil'
  | 'plus'
  | 'minus'
  | 'back'
  | 'check'
  | 'brand';

/** 24x24 stroke paths. Drawn here so the app needs no icon font. */
const PATHS: Record<IconName, string[]> = {
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  fat: ['M12 3c3.2 4 5.8 6.9 5.8 10.2a5.8 5.8 0 0 1-11.6 0C6.2 9.9 8.8 7 12 3z'],
  protein: ['M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 4.5 0 0 0-6.23 6.23', 'm8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59'],
  carbs: ['M12 21V9', 'M12 9c-2.6 0-4.1-1.5-4.1-4.1 2.6 0 4.1 1.5 4.1 4.1z', 'M12 9c2.6 0 4.1-1.5 4.1-4.1-2.6 0-4.1 1.5-4.1 4.1z', 'M12 15c-2.6 0-4.1-1.5-4.1-4.1 2.6 0 4.1 1.5 4.1 4.1z', 'M12 15c2.6 0 4.1-1.5 4.1-4.1-2.6 0-4.1 1.5-4.1 4.1z'],
  scale: ['M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M8 9.5a5.5 5.5 0 0 1 8 0', 'M12 12.5l1.6-2.2'],
  camera: ['M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.2-1.8h6.2L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z', 'M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  pencil: ['M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19z', 'M14.5 6.5l3 3'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  back: ['M15 5l-7 7 7 7'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  brand: [],
};

type Props = {
  name: IconName;
  size?: number;
  color: string;
  /** Fill the shape (flame, drop) instead of outlining it. */
  filled?: boolean;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color, filled, strokeWidth = 2 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {name === 'brand' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} />
          <Circle cx={12} cy={12} r={2.8} fill={color} />
        </>
      ) : (
        PATHS[name].map((d, i) => <Path key={i} d={d} fill={filled && i === 0 ? color : 'none'} />)
      )}
    </Svg>
  );
}
