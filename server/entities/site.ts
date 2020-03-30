import { Entity, Column, PrimaryColumn, ManyToMany, JoinTable } from 'typeorm';
import { User } from './user';

@Entity()
export class Site {
	@PrimaryColumn()
	domain: string = '';

	@Column()
	proxyType: string = '';

	@Column()
	url: string = '';

	@Column()
	accessToken: string = '';

	@ManyToMany(() => User, (user) => user.sites)
	@JoinTable()
	editors?: User[];
}
