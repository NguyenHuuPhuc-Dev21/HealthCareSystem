import icon from '../../../assets/carenest-icon.svg';

interface LogoProps {
    onDark?: boolean;
}

/** Logo chính thức CareNest — file icon tại docs/design/logo/carenest-icon.svg. */
export default function Logo({ onDark = false }: LogoProps) {
    return (
        <a className={onDark ? 'logo on-dark' : 'logo'} href="#top" aria-label="CareNest — về đầu trang">
            <img src={icon} alt="" width={36} height={36} />
            <span>CareNest</span>
        </a>
    );
}