// <copyright file="manager-dashboard.tsx" company="Microsoft Corporation">
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// </copyright>

import * as React from "react";
import { Flex, Provider, Input, Checkbox, Text, Table, Divider, Button, Avatar, Dialog, List, Loader } from '@fluentui/react-northstar';
import { SearchIcon, AcceptIcon, QuestionCircleIcon, CloseIcon, AddIcon, ChevronEndIcon, ChevronStartIcon } from '@fluentui/react-icons-northstar';
import Constants, { NavigationCommand, ResponseStatus } from "../../constants/constants";
import { TimesheetStatus } from "../../models/timesheet-status";
import { IDashboardRequest } from "../../models/dashboard-request";
import { WithTranslation, withTranslation } from "react-i18next";
import { TFunction } from "i18next";
import withContext, { IWithContext } from "../../providers/context-provider";
import { cloneDeep } from "lodash";
import { getDashboardRequestsAsync } from "../../api/timesheet";
import { approveTimesheetsAsync, rejectTimesheetsAsync, approveTimesheetsByUserIdsAsync, rejectTimesheetsByUserIdsAsync } from "../../api/timesheet";
import { withRouter, RouteComponentProps } from "react-router-dom";
import { IDashboardProject } from "../../models/dashboard/dashboard-project";
import DashboardProject from "../dashboard-projects-wrapper/dashboard-projects-wrapper";
import { getDashboardProjectsAsync } from "../../api/project";
import moment from "moment";
import { Guid } from "guid-typescript";
import { StatusCodes } from "http-status-codes";
import { IRequestApproval } from "../../models/request-approval";

import "./manager-dashboard.scss";

interface IManagerDashboardState {
    dashboardRequests: IDashboardRequest[];
    searchDashboardRequests: IDashboardRequest[];
    isActionEnabled: boolean;
    isAllDashboardRequestsSelected: boolean;
    isLoading: boolean;
    isMobileView: boolean;
    isApproveDialogOpen: boolean;
    isRejectDialogOpen: boolean;
    isSelectMultiple: boolean;
    searchText: string;
    dashboardProjects: IDashboardProject[];
    visibleProjectDetails: IDashboardProject[];
    searchProjectsMobile: IDashboardProject[];
    pageNumber: number;
    isStart: boolean;
    isEnd: boolean;
}

interface IManagerDashboardProps extends WithTranslation, IWithContext, RouteComponentProps {
}

// Table column width used in this component.
const tableColumnWidth: string = "17vw";

// The class manages manager dashboard requests and projects.
class ManagerDashboard extends React.Component<IManagerDashboardProps, IManagerDashboardState> {
    readonly localize: TFunction;

    // Table column design.
    tableCheckboxColumnDesign: any = { minWidth: Constants.tableCheckboxColumnWidth, maxWidth: Constants.tableCheckboxColumnWidth };

    // Table column design.
    tableColumnDesign: any = { minWidth: tableColumnWidth, maxWidth: tableColumnWidth };

    /** 
     * Constructor which initializes state. 
     */
    constructor(props: any) {
        super(props);
        this.localize = this.props.t;
        this.state = {
            isApproveDialogOpen: false,
            isRejectDialogOpen: false,
            dashboardRequests: [],
            searchDashboardRequests: [],
            isAllDashboardRequestsSelected: false,
            isActionEnabled: false,
            isLoading: false,
            isMobileView: false,
            isSelectMultiple: false,
            searchText: "",
            dashboardProjects: [],
            visibleProjectDetails: [],
            searchProjectsMobile: [],
            pageNumber: 0,
            isStart: false,
            isEnd: false,
        };
    }

    /**
     * Called when component unmount.
     */
    componentWillUnmount() {
        window.removeEventListener("resize", this.onScreenSizeChange);
    }

    /** 
     * Called when component mount.
     */
    componentDidMount() {
        window.addEventListener("resize", this.onScreenSizeChange);
        this.getDashboardTimesheetsAsync();
        this.getDashboardProjectsAsync();
    }

    /**
     * Gets the dashboard timesheets.
     */
    getDashboardTimesheetsAsync = async () => {
        this.setState({ isLoading: true });
        let response = await getDashboardRequestsAsync(this.handleTokenAccessFailure);
        if (response.status === StatusCodes.OK && response.data) {
            this.setState({ dashboardRequests: response.data, isLoading: false });
        } else {
            this.setState({ isLoading: false });
        }
    }

    /** 
     * Called when screen size gets updated; which sets the state to indicate whether mobile view enabled. 
     */
    onScreenSizeChange = () => {
        this.setState({ isMobileView: window.innerWidth <= Constants.maxWidthForMobileView });
    }

    /**
     * The event handler called when click on reject button.
     */
    onRejectClick = async () => {
        let dashboardRequests = cloneDeep(this.state.dashboardRequests);
        let selectedTimesheetRequests = this.getSelectedTimesheets();
        let isUpdated = await this.requestUpdateAsync(selectedTimesheetRequests, TimesheetStatus.Rejected);
        this.setState({ isLoading: true });
        if (isUpdated) {
            selectedTimesheetRequests.map((selectedDashboardRequest: IDashboardRequest) => {
                selectedDashboardRequest.status = TimesheetStatus.Approved;
                let index = dashboardRequests.findIndex((item: IDashboardRequest) => item.userId === selectedDashboardRequest.userId);
                dashboardRequests.splice(index, 1);
            });
            this.setState((prevState: IManagerDashboardState) => ({
                dashboardRequests,
                isApproveDialogOpen: !prevState.isApproveDialogOpen,
                isActionEnabled: false,
                isLoading: false
            }));
        }
        else {
            this.setState({ isLoading: false });
        }
    }

    /** 
     * Gets selected requests. 
     */
    getSelectedTimesheets = () => {
        return cloneDeep(this.state.dashboardRequests.filter((dashboardRequest: IDashboardRequest) => dashboardRequest.isSelected));
    }

    /**
     * Event handler when user approve/reject request(s).
     * @param selectedRequests The array of selected request.
     * @param status The status to be update.
     */
    requestUpdateAsync = async (selectedRequests: Array<IDashboardRequest>, status: TimesheetStatus) => {
        this.setState({ isLoading: true });
        let requestApproval: IRequestApproval[] = [];

        selectedRequests.map((timesheet: IDashboardRequest) => {
            timesheet.submittedTimesheetIds.map((timesheetId: Guid) => {
                requestApproval.push({
                    managerComments: "",
                    status: status,
                    userId: timesheet.userId,
                    timesheetDate: [],
                    timesheetId: timesheetId
                });
            });
        });
        let response: any;
        switch (status) {
            case TimesheetStatus.Approved:
                response = await approveTimesheetsAsync(requestApproval, this.handleTokenAccessFailure);
                break;
            case TimesheetStatus.Rejected:
                response = await rejectTimesheetsAsync(requestApproval, this.handleTokenAccessFailure);
                break;
        }

        if (response.status === StatusCodes.NO_CONTENT) {
            this.setState({ isLoading: false });
            return true;
        } else {
            this.setState({ isLoading: false });
            return false;
        }
    }

    /** 
     * The event handler called when click on approve button. 
     */
    onApproveClick = async () => {
        let dashboardRequests = cloneDeep(this.state.dashboardRequests);
        let selectedTimesheet = this.getSelectedTimesheets();
        let isUpdated = await this.requestUpdateAsync(selectedTimesheet, TimesheetStatus.Approved);
        this.setState({ isLoading: true });
        if (isUpdated) {
            selectedTimesheet.map((selectedDashboardRequest: IDashboardRequest) => {
                selectedDashboardRequest.status = TimesheetStatus.Approved;
                let index = dashboardRequests.findIndex((dashboardRequest: IDashboardRequest) => dashboardRequest.userId === selectedDashboardRequest.userId);
                dashboardRequests.splice(index, 1);
            });
            this.setState((prevState: IManagerDashboardState) => ({
                dashboardRequests,
                isApproveDialogOpen: !prevState.isApproveDialogOpen,
                isActionEnabled: false,
                isLoading: false,
            }));
        }
        else {
            this.setState({ isLoading: false });
        }
    }

    /** 
     * Event handler when user reject request. 
     */
    onRejectDialogTriggerOrClose() {
        this.setState((prevState: IManagerDashboardState) => ({
            isRejectDialogOpen: !prevState.isRejectDialogOpen
        }));
    }

    /** 
     * Event handler when user approve request. 
     */
    onApproveDialogTriggerOrClose() {
        this.setState((prevState: IManagerDashboardState) => ({
            isApproveDialogOpen: !prevState.isApproveDialogOpen
        }));
    }

    /** 
     * Searches requests based on search text and display search results. 
     */
    searchTimesheet = () => {
        let dashboardRequests: Array<IDashboardRequest> = cloneDeep(this.state.dashboardRequests) ?? [];
        let searchedTimesheets = dashboardRequests.filter((dashboardRequest: IDashboardRequest) => {
            return dashboardRequest.userName.toLowerCase().indexOf(this.state.searchText.toLowerCase()) > -1;
        });

        this.setState({ searchDashboardRequests: searchedTimesheets });
    }

    /**
     * The event handler called when searching dashboard requests/projects.
     * @param event The input event object.
     */
    onSearchTextChanged = (event: any) => {
        let dashboardRequests: Array<IDashboardRequest> = cloneDeep(this.state.dashboardRequests) ?? [];
        this.setState({ searchText: event.target.value });

        if (dashboardRequests.length > 0 && this.state.searchText && this.state.searchText.trim() !== "") {
            this.searchTimesheet();
        }
        else {
            this.setState({ dashboardRequests });
        }

        if (dashboardRequests.length === 0) {
            this.setState({ searchText: "" });
        }
    }

    /** 
     * Manages 'Reject' and 'Approve' button's enability and manages select all dashboard request checked state. 
     */
    manageControlsEnabilityAndSelection = () => {
        let selectedDashboardRequestsCount = this.state.dashboardRequests.filter((dashboardRequest: IDashboardRequest) => dashboardRequest.isSelected)?.length;
        let isAllDashboardRequestsSelected = selectedDashboardRequestsCount === this.state.dashboardRequests.length;

        if (selectedDashboardRequestsCount > 0) {
            this.setState({ isActionEnabled: true, isAllDashboardRequestsSelected });
        }
        else {
            this.setState({ isActionEnabled: false, isSelectMultiple: false, isAllDashboardRequestsSelected });
        }
    }

    /**
     * The event handler called when any dashboard requests checked state changed.
     * @param dashboardRequest The selected dashboard requests details.
     */
    onRequestCheckedChange = (dashboardRequest: IDashboardRequest) => {
        let dashboardRequests = cloneDeep(this.state.dashboardRequests);
        let checkedRequest = dashboardRequests.find((request: IDashboardRequest) => request.userId.toString() === dashboardRequest.userId.toString())!;
        checkedRequest.isSelected = !checkedRequest.isSelected;
        this.setState({ dashboardRequests }, this.manageControlsEnabilityAndSelection);
    }

    /** 
     * The event handler called when select all dashboard-requests checked state changed. 
     */
    onSelectAllRequestsCheckedChange = () => {
        if (this.state.dashboardRequests && this.state.dashboardRequests.length > 0) {
            let dashboardRequests = cloneDeep(this.state.dashboardRequests);
            let selectedDashboardRequestCount = this.getSelectedRequestsCount();
            if (selectedDashboardRequestCount !== this.state.dashboardRequests.length) {
                dashboardRequests.map((dashboardRequest: IDashboardRequest) => {
                    dashboardRequest.isSelected = true;
                });
            }
            else {
                dashboardRequests.map((dashboardRequest: IDashboardRequest) => {
                    dashboardRequest.isSelected = !dashboardRequest.isSelected;
                });
            }

            this.setState({ dashboardRequests }, this.manageControlsEnabilityAndSelection);
        }
    }

    /** 
     * Get selected count of dashboard request. 
     */
    getSelectedRequestsCount = () => {
        if (this.state.dashboardRequests.length > 0) {
            return this.state.dashboardRequests.filter((dashboardRequest: IDashboardRequest) => dashboardRequest.isSelected)?.length;
        }
        return 0;
    }

    /** 
     * Invoked when user clicks on requests. 
     */
    onRequestClick = (dashboardRequest: IDashboardRequest) => {
        this.props.microsoftTeams.tasks.startTask({
            title: this.localize("timesheetRequestLabel"),
            height: Constants.taskModuleHeight,
            width: Constants.taskModuleWidth,
            url: `${window.location.origin}/request-review/${dashboardRequest.userId.toString()}/${dashboardRequest.userName}/${this.state.isMobileView}`
        }, (error: any, result: any) => {
            //TODO pending 
        });
    }

    /** 
     * Return error component. 
     */
    getErrorMessage = () => {
        return (
            <Flex className="manage-timesheet-request-content" gap="gap.small">
                <Flex.Item>
                    <div className="error-container">
                        <QuestionCircleIcon outline color="green" />
                    </div>
                </Flex.Item>
                <Flex.Item grow>
                    <Flex column gap="gap.small" vAlign="stretch">
                        <div>
                            <Text weight="bold" content={this.localize("timesheetRequestNotAvailableHeaderDescription")} /><br />
                            <Text content={
                                this.state.searchText !== "" ?
                                    this.localize("timesheetRequestNotFoundForSearchedTextDescription", { searchedText: this.state.searchText }) :
                                    this.localize("timesheetRequestNotAvailableHeaderDescription")}
                            />
                        </div>
                    </Flex>
                </Flex.Item>
            </Flex>
        );
    }

    /**
     * Invoked when user select multiple requests.
     */
    onSelectMultiple = () => {
        this.setState((prevState: IManagerDashboardState) => ({
            isSelectMultiple: !prevState.isSelectMultiple
        }));
    }

    /**
     * Get string to show in requested for column.
     * @param dateRange Date range of the submitted timesheets.
     */
    getDateRangeText(dateRange: Date[][]) {
        let requestedFor: string = "";
        let month: number = moment(dateRange[0][0]).month();
        for (let item = 0; item < dateRange.length; item++) {
            if (dateRange[item].length > 0) {
                let isTimesheetForOneDay = dateRange[item][0] == dateRange[item][dateRange[item].length - 1];
                let date = isTimesheetForOneDay ? moment(dateRange[item][0]).format("DD") : `${moment(dateRange[item][0]).format("DD")}-${moment(dateRange[item][dateRange[item].length - 1]).format("DD")}`;

                if (dateRange[item + 1]) {
                    if (moment(dateRange[item + 1][0]).month() !== month) {
                        month = moment(dateRange[item][0]).month();
                        date = date.concat(` ${moment(dateRange[item][0]).format("MMM")}`);
                    }
                }
                else if (dateRange[dateRange.length - 1][dateRange[item].length - 1] === dateRange[item][dateRange[item].length - 1]) {
                    date = date.concat(` ${moment(dateRange[item][0]).format("MMM")}`);
                }

                if (dateRange[0][0] == dateRange[item][0]) {
                    requestedFor = requestedFor.concat(`${date}`);
                }
                else {
                    requestedFor = requestedFor.concat(`, ${date}`);
                }
            }
        }

        return requestedFor;
    }

    /**
     * Render member list. 
     */
    renderMemberList = () => {
        let dashboardRequests = this.state.searchText !== "" ? this.state.searchDashboardRequests : this.state.dashboardRequests;
        if (dashboardRequests?.length <= 0) {
            return (
                this.getErrorMessage()
            );
        }

        let items: Array<any> = dashboardRequests.map((dashboardRequest: IDashboardRequest, index: number) => {
            return {
                key: `timesheetRequest-${index}`,
                content:
                    <div>
                        <Flex className="list-row" vAlign="center" key={`timesheetRequest-${index}`}>
                            <Flex className="full-width" vAlign="center" gap="gap.small">
                                <Avatar name={dashboardRequest.userName} />
                                <Flex className="full-width" column vAlign="center">
                                    <Flex>
                                        <Text onClick={() => this.onRequestClick(dashboardRequest)} className="mobile-title" content={dashboardRequest.userName} />
                                        <Flex.Item push>
                                            {this.state.isSelectMultiple
                                                ? <Checkbox key={index} checked={dashboardRequest.isSelected} onChange={() => this.onRequestCheckedChange(dashboardRequest)} />
                                                : <Text className="mobile-subtitle" content={this.getDateRangeText(dashboardRequest.requestedForDates)} />}
                                        </Flex.Item>
                                    </Flex>
                                    <Text className="mobile-subtitle" content={this.localize("hours", { hourNumber: dashboardRequest.totalHours })} />
                                </Flex>
                            </Flex>
                        </Flex>
                        <Divider />
                    </div>
            };
        });
        return (
            <List items={items} />
        );
    }

    /** 
     * Renders mobile view for requests. 
     */
    renderMobileView = () => {
        return (<div className="dashboard-mobile-view">
            <Flex vAlign="center" className="list-header" padding="padding.medium">
                <Text content={this.localize("request")} size="large" weight="semibold" />
                <Flex.Item push>
                    <div>
                        {!this.state.isSelectMultiple && this.state.dashboardRequests.length > 0 &&
                            <Button
                                className="select-multiple-button"
                                text
                                content={this.localize("selectMultiple")}
                                onClick={this.onSelectMultiple}
                            />
                        }
                        {this.state.isSelectMultiple && <Text size="medium" content={`${this.getSelectedRequestsCount()} ${this.localize("selected")}`} className="selected-text" />}
                    </div>
                </Flex.Item>
            </Flex>
            {this.renderMemberList()}
            {this.state.isSelectMultiple && this.renderMobileAction()}
        </div>
        );
    }

    /** 
     * Render requests. 
     */
    renderRequests = () => {
        let dashboardRequests = this.state.searchText !== "" ? this.state.searchDashboardRequests : this.state.dashboardRequests;

        if (dashboardRequests?.length > 0) {
            const dashboardRequestTableHeaderItems = {
                key: "header",
                items: [
                    {
                        content: <AcceptIcon className="accept-all-icon" outline key="timesheetRequestTableHeader" onClick={this.onSelectAllRequestsCheckedChange} />,
                        design: this.tableCheckboxColumnDesign
                    },
                    {
                        content: <Text weight="semibold" className="table-header" content={this.localize("employee")} />,
                        design: this.tableColumnDesign
                    },
                    {
                        content: <Text weight="semibold" className="table-header" content={this.localize("numberOfDays")} />,
                        design: this.tableColumnDesign
                    },
                    {
                        content: <Text weight="semibold" className="table-header" content={this.localize("requestedFor")} />,
                        design: this.tableColumnDesign
                    },
                    {
                        content: <Text weight="semibold" className="table-header" content={this.localize("totalHours")} />,
                        design: this.tableColumnDesign
                    }
                ]
            };

            let rows = dashboardRequests.map((dashboardRequest: IDashboardRequest, index: number) => {
                return {
                    "key": `dashboard-request-${index}`,
                    "items": [
                        {
                            content: <Checkbox key={index} checked={dashboardRequest.isSelected} onChange={() => this.onRequestCheckedChange(dashboardRequest)} />,
                            design: this.tableCheckboxColumnDesign
                        },
                        {
                            content: <Flex className="user-title-container" vAlign="center" onClick={() => this.onRequestClick(dashboardRequest)} ><Avatar className="user-image" name={dashboardRequest.userName} /><Text content={dashboardRequest.userName} /></Flex>,
                            title: dashboardRequest.userName,
                            truncateContent: true,
                            design: this.tableColumnDesign
                        },
                        {
                            content: dashboardRequest.numberOfDays,
                            title: dashboardRequest.numberOfDays,
                            truncateContent: true,
                            design: this.tableColumnDesign
                        },
                        {
                            content: this.getDateRangeText(dashboardRequest.requestedForDates),
                            title: this.getDateRangeText(dashboardRequest.requestedForDates),
                            truncateContent: true,
                            design: this.tableColumnDesign
                        },
                        {
                            content: dashboardRequest.totalHours,
                            title: dashboardRequest.totalHours,
                            truncateContent: true,
                            design: this.tableColumnDesign
                        }
                    ]
                };
            });

            return (
                <Table className="manage-timesheet-content  manage-timesheet-request-content-background"
                    header={dashboardRequestTableHeaderItems}
                    rows={rows}
                />
            );
        }
        else {
            return (
                this.getErrorMessage()
            );
        }
    }

    /** 
     * Renders action for mobile view. 
     */
    renderMobileAction = () => {
        if (this.state.isSelectMultiple && this.state.isMobileView) {
            return (
                <div className="footer">
                    <Flex space="between" vAlign="center">
                        <Flex.Item push >
                            <Flex gap="gap.small">
                                <Dialog
                                    className="request-review-dialog"
                                    design={{ width: "27rem !important", height: "9.8rem !important", padding: "0rem" }}
                                    header={
                                        <Flex className="dialog-header" vAlign="center" hAlign="center">
                                            <Text content={`${this.localize("reject")} ${this.getSelectedRequestsCount()} requests?`} weight="semibold" />
                                        </Flex>}
                                    closeOnOutsideClick={true}
                                    trigger={
                                        <Button disabled={!this.state.isActionEnabled} className={!this.state.isActionEnabled ? "list-timesheet-menu-button-disabled" : "list-timesheet-menu-button-reject"} content={this.localize("reject")}
                                            onClick={() => this.onRejectDialogTriggerOrClose()}
                                        />
                                    }
                                    footer={
                                        <Flex>
                                            <Button className="dialog-button-left" content={<Text className="dialog-button-text" content="No" />} onClick={() => this.onRejectDialogTriggerOrClose()} />
                                            <Button className="dialog-button-right" content={<Text className="dialog-button-text" content="Yes" />} onClick={() => this.onRejectClick()} />
                                        </Flex>}
                                    open={this.state.isRejectDialogOpen}
                                />
                                <Dialog
                                    className="request-review-dialog"
                                    design={{ width: "27rem !important", height: "9.8rem !important", padding: "0rem" }}
                                    header={
                                        <Flex className="dialog-header" vAlign="center" hAlign="center">
                                            <Text content={`${this.localize("approve")} ${this.getSelectedRequestsCount()} requests?`} weight="semibold" />
                                        </Flex>}
                                    closeOnOutsideClick={true}
                                    trigger={
                                        <Button primary disabled={!this.state.isActionEnabled} className="list-timesheet-request-menu-button" content={this.localize("approve")}
                                            onClick={() => this.onApproveDialogTriggerOrClose()}
                                        />
                                    }
                                    footer={
                                        <Flex>
                                            <Button className="dialog-button-left" content={<Text className="dialog-button-text" content="No" />} onClick={() => this.onApproveDialogTriggerOrClose()} />
                                            <Button className="dialog-button-right" content={<Text className="dialog-button-text" content="Yes" />} onClick={() => this.onApproveClick()} />
                                        </Flex>}
                                    open={this.state.isApproveDialogOpen}
                                />
                            </Flex>
                        </Flex.Item>
                    </Flex>
                </div>
            );
        }
    }

    /**
     * Renders actions for requests table. 
     */
    renderAction = () => {
        if (this.state.isActionEnabled && !this.state.isMobileView) {
            return (
                <Flex.Item push >
                    <Flex vAlign="center">
                        <Text className="selected-text" content={`${this.getSelectedRequestsCount()} ${this.localize("selected")}`} />
                        <Dialog
                            design={{ width: "40rem !important", height: "14.9rem" }}
                            header={<Text content={`${this.localize("reject")} ${this.getSelectedRequestsCount()} requests?`} weight="semibold" />}
                            cancelButton={this.localize("confirmationNo")}
                            confirmButton={this.localize("confirmationYes")}
                            onConfirm={() => this.onRejectClick()}
                            trigger={
                                <Button text disabled={!this.state.isActionEnabled} icon={<CloseIcon />} content={this.localize("reject")} />
                            }
                        />
                        <Dialog
                            design={{ width: "40rem !important", height: "14.9rem" }}
                            header={<Text content={`${this.localize("approve")} ${this.getSelectedRequestsCount()} requests?`} weight="semibold" />}
                            cancelButton={this.localize("confirmationNo")}
                            confirmButton={this.localize("confirmationYes")}
                            onConfirm={() => this.onApproveClick()}
                            trigger={
                                <Button text disabled={!this.state.isActionEnabled} icon={<AcceptIcon />} content={this.localize("approve")} />
                            }
                        />
                    </Flex>
                </Flex.Item>
            );
        }
    }

    /** 
     * Render desktop view for requests. 
     */
    renderDesktopView = () => {
        return (
            <Flex column>
                <div className="table-heading">
                    <Flex>
                        <Text content={this.localize("request")} size="large" weight="semibold" />
                        {this.renderAction()}
                    </Flex>
                </div>
                <div className="timesheet-table">
                    {this.renderRequests()}
                </div>
            </Flex>);
    }

    /**
     * Converts local date to UTC date.
     * @param date The date to be converted.
     */
    getUtcDate = (date: Date) => {
        let utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
            date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
        return new Date(utcDate);
    }

    /** Gets active and approve projects details for current month */
    getDashboardProjectsAsync = async () => {
        this.setState({ isLoading: true });

        let date = new Date();
        let firstDate = new Date(date.getFullYear(), new Date().getMonth(), 1);
        let endDate = new Date(date.getFullYear(), new Date().getMonth() + 1, 0);

        // Get first date and last date of current month
        let firstDay = this.getUtcDate(firstDate);
        let lastDay = this.getUtcDate(endDate);

        let response = await getDashboardProjectsAsync(firstDay, lastDay, this.handleTokenAccessFailure);
        if (response && response.status === ResponseStatus.OK && response.data) {
            this.setState({
                dashboardProjects: response.data,
                isLoading: false
            });
        }
        else {
            this.setState({ isLoading: false });
        }
        this.pageNavigation(NavigationCommand.Default);
    }

    /**
     * Handles token access failure.
     * @param error Error string.
     */
    handleTokenAccessFailure = (error: string) => {
        this.props.history.push("/signin");
    }

    /**
     * Handle project cards navigation.
     * @param navigationCommand Navigation command (forward/backward).
     */
    pageNavigation = (navigationCommand: NavigationCommand) => {
        // Default page number.
        let pageNumber = 1;

        // When user click forward button on projects bar increment number by one.
        if (navigationCommand === NavigationCommand.Forward) {
            pageNumber = this.state.pageNumber + 1;
        }
        // When user click backward button on projects bar decrement number by one.
        else if (navigationCommand === NavigationCommand.Backward && pageNumber > 1) {
            pageNumber = this.state.pageNumber - 1;
        }

        let visibleProjects: Array<IDashboardProject> = [];
        let projectDetails = this.state.searchText ? this.state.searchProjectsMobile : this.state.dashboardProjects;

        // Set upper limit of the project cards to show.
        let upperLimit = pageNumber * 3;

        // Set lower limit of the project cards to show.
        let lowerLimit = upperLimit - 3;

        if (upperLimit < projectDetails.length) {
            // Get projects from lower limit to upper limit.
            for (let i = lowerLimit; i < upperLimit; i++) {
                visibleProjects.push(projectDetails[i]);
            }

            // If page number is 1 then backward button gets disabled using isStart state.
            if (pageNumber === 1) {
                this.setState({ pageNumber: pageNumber, visibleProjectDetails: visibleProjects, isStart: true, isEnd: false });
            }
            // Both button is enabled.
            else {
                this.setState({ pageNumber: pageNumber, visibleProjectDetails: visibleProjects, isStart: false, isEnd: false });
            }
        }
        else {
            // Get projects from lower limit to projects length.
            for (let i = lowerLimit; i < projectDetails.length; i++) {
                visibleProjects.push(projectDetails[i]);
            }

            // If page number is 1 and upper limit is greater than project length 
            // then forward and backward both button gets disabled using isStart and isEnd state.
            if (pageNumber === 1) {
                this.setState({ pageNumber: pageNumber, visibleProjectDetails: visibleProjects, isStart: true, isEnd: true });
            }
            // Only backward button is enabled.
            else {
                this.setState({ pageNumber: pageNumber, visibleProjectDetails: visibleProjects, isStart: false, isEnd: true });
            }
        }
    }

    /**
     * Invoked when user clicks on project card.
     * @param project The project id of which project utilization task module to open.
     */
    onProjectCardClick = (projectId: string) => {
        this.props.microsoftTeams.tasks.startTask({
            title: this.localize("projectUtilization"),
            height: 746,
            width: 601,
            url: `${window.location.origin}/manage-project/${projectId}/${this.state.isMobileView}`
        });
    }

    /** 
     * Handles visibility of projects cards.
     */
    getVisibleProjects = () => {
        let projects = this.state.searchText !== ""
            ? (
                this.state.isMobileView
                    ? this.state.searchProjectsMobile
                    : this.state.visibleProjectDetails
            )
            : (
                this.state.isMobileView
                    ? this.state.dashboardProjects
                    : this.state.visibleProjectDetails
            );

        return projects;
    }

    /** 
     * Renders the component. 
     */
    render() {
        if (this.state.isLoading) {
            return <Loader />;
        }

        return (
            <Provider>
                <Flex>
                    <div className="dashboard-container">
                        <Flex >
                            <Flex.Item push>
                                <Input
                                    inverted
                                    icon={<SearchIcon />}
                                    placeholder={this.localize("searchForRequestPlaceholder")}
                                    input={{ design: { minWidth: "30rem", maxWidth: "30rem" } }}
                                    onChange={this.onSearchTextChanged}
                                />
                            </Flex.Item>
                        </Flex>
                        <Flex vAlign="center">
                            <Text className="project-header" weight="semibold" content={this.localize("projectHeader")} />
                            <Flex.Item push>
                                <div>
                                    <Button text icon={<AddIcon className="add-project-icon" />} content={this.localize("addProject")} />
                                    {!this.state.isMobileView &&
                                        <>
                                            <Button text icon={<ChevronStartIcon />} disabled={this.state.isStart} onClick={() => this.pageNavigation(NavigationCommand.Backward)} />
                                            <Button text icon={<ChevronEndIcon />} disabled={this.state.isEnd} onClick={() => this.pageNavigation(NavigationCommand.Forward)} />
                                        </>
                                    }
                                </div>
                            </Flex.Item>
                        </Flex>
                        <div className={this.state.isMobileView ? "dashboard-projects-mobile-container" : ""}>
                            <DashboardProject projects={this.getVisibleProjects()} onProjectCardClick={this.onProjectCardClick} isMobileView={this.state.isMobileView} />
                        </div>
                        <Divider />
                        {this.state.isMobileView ? this.renderMobileView() : this.renderDesktopView()}
                    </div>
                </Flex>
            </Provider>
        );
    }
}

export default withTranslation()(withContext(withRouter(ManagerDashboard)));