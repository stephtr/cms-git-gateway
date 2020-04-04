import {
	Entity,
	Column,
	ManyToMany,
	JoinTable,
	PrimaryGeneratedColumn,
	Index,
} from 'typeorm';
import { User } from './user';

@Entity()
export class Site {
	@PrimaryGeneratedColumn()
	id: number = 0;

	@Column()
	@Index({ unique: true })
	domain: string = '';

	@Column()
	proxyType: string = '';

	@Column()
	repository: string = '';

	@Column()
	accessToken: string = '';

	@ManyToMany(() => User, (user) => user.sites)
	@JoinTable()
	editors?: User[];
}

export enum ProxyTypes {
	GitHub = 'GitHub',
	GitLab = 'GitLab',
	Bitbucket = 'Bitbucket',
}
